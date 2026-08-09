'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { TraceFrame } from '@/lib/db/sandbox';

interface TraceVisualizerProps {
  frames: TraceFrame[];
  currentFrameIndex: number;
}

export function TraceVisualizer({ frames, currentFrameIndex }: TraceVisualizerProps) {
  const frame = frames[currentFrameIndex];
  const stackRef = useRef<SVGSVGElement>(null);

  // D3: render call stack as a ladder
  useEffect(() => {
    if (!stackRef.current || !frame) return;

    const svg = d3.select(stackRef.current);
    svg.selectAll('*').remove();

    const stack = frame.callStack;
    const width = stackRef.current.clientWidth || 280;
    const itemH = 36;
    const svgH = Math.max(80, stack.length * itemH + 20);

    svg.attr('height', svgH);

    const g = svg.append('g').attr('transform', 'translate(0, 10)');

    // Render stack frames bottom-to-top (bottom = oldest)
    const reversed = [...stack].reverse();
    reversed.forEach((fn, i) => {
      const y = (reversed.length - 1 - i) * itemH;
      const isTop = i === reversed.length - 1;

      // Frame box
      g.append('rect')
        .attr('x', 8)
        .attr('y', y)
        .attr('width', width - 16)
        .attr('height', itemH - 4)
        .attr('rx', 6)
        .attr('fill', isTop ? 'rgba(124, 92, 255, 0.25)' : 'rgba(255,255,255,0.05)')
        .attr('stroke', isTop ? '#7C5CFF' : 'rgba(255,255,255,0.1)')
        .attr('stroke-width', isTop ? 1.5 : 1);

      // Frame label
      g.append('text')
        .attr('x', 18)
        .attr('y', y + 22)
        .attr('fill', isTop ? '#c4b5fd' : '#94a3b8')
        .attr('font-size', '12px')
        .attr('font-family', 'monospace')
        .text(fn || '<module>');
    });
  }, [frame, currentFrameIndex]);

  if (!frame) {
    return (
      <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
        Run your code to see execution trace.
      </div>
    );
  }

  const variables = Object.entries(frame.variables);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Frame info */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          background: 'rgba(124,92,255,0.2)', color: '#c4b5fd',
          borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace'
        }}>
          Line {frame.line}
        </span>
        <span style={{
          background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
          borderRadius: 4, padding: '2px 8px', fontSize: 11
        }}>
          {frame.event}
        </span>
        {frame.returnValue !== undefined && (
          <span style={{
            background: 'rgba(16,185,129,0.15)', color: '#34d399',
            borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace'
          }}>
            → {frame.returnValue}
          </span>
        )}
      </div>

      {/* Variable inspector */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Variables
        </div>
        {variables.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 12 }}>No variables in scope</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: 4, fontSize: 11 }}>Name</th>
                <th style={{ textAlign: 'left', color: '#64748b', fontWeight: 500, paddingBottom: 4, fontSize: 11 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {variables.map(([name, value]) => (
                <tr key={name} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '4px 8px 4px 0', color: '#93c5fd', fontFamily: 'monospace' }}>{name}</td>
                  <td style={{ padding: '4px 0', color: '#e2e8f0', fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Call stack */}
      <div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Call Stack
        </div>
        <svg ref={stackRef} style={{ width: '100%', overflow: 'visible' }} />
      </div>
    </div>
  );
}
