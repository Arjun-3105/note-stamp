import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSource } from '@/lib/db/sources';

/**
 * GET /api/sources/:sourceId
 * Get a specific source
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceId } = await params;
    const source = await getSource(sourceId);
    if (!source || source.userId !== userId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error('Get source error:', error);
    return NextResponse.json(
      { error: 'Failed to get source' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sources/:sourceId
 * Update source metadata
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceId } = await params;
    
    // Check if source belongs to user
    const { getSource, updateSourceMetadata } = await import('@/lib/db/sources');
    const existing = await getSource(sourceId);
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const body = await req.json();
    if (body.metadata === undefined) {
      return NextResponse.json({ error: 'Metadata is required' }, { status: 400 });
    }

    const updated = await updateSourceMetadata(sourceId, typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata));
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update source error:', error);
    return NextResponse.json(
      { error: 'Failed to update source' },
      { status: 500 }
    );
  }
}
