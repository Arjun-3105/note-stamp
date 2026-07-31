import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createNote, getNoteBySource, updateNote } from '@/lib/db/notes';
import { getSource } from '@/lib/db/sources';

/**
 * GET /api/notes?sourceId=:sourceId
 * Get notes for a source
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId parameter required' },
        { status: 400 }
      );
    }

    // Verify user owns the source
    const source = await getSource(sourceId);
    if (!source || source.userId !== userId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const note = await getNoteBySource(sourceId);

    return NextResponse.json({
      note: note || null,
    });
  } catch (error) {
    console.error('Get notes error:', error);
    return NextResponse.json(
      { error: 'Failed to get notes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes
 * Create or update notes for a source
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sourceId, content } = body;

    if (!sourceId || !content) {
      return NextResponse.json(
        { error: 'sourceId and content required' },
        { status: 400 }
      );
    }

    // Verify user owns the source
    const source = await getSource(sourceId);
    if (!source || source.userId !== userId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check if note exists
    const existingNote = await getNoteBySource(sourceId);

    let note;
    if (existingNote) {
      // Update existing note
      note = await updateNote(existingNote.$id, content);
    } else {
      // Create new note
      note = await createNote({
        sourceId,
        userId,
        title: source.title || 'Untitled Note',
        content,
      });
    }

    return NextResponse.json(note, { status: existingNote ? 200 : 201 });
  } catch (error) {
    console.error('Create/update notes error:', error);
    return NextResponse.json(
      { error: 'Failed to save notes' },
      { status: 500 }
    );
  }
}

