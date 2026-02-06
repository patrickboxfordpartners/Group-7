import { NextResponse } from 'next/server';
import { getEvent, updateEvent, addFeedback, log } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const { eventId, feedback, modifiedResponse } = await req.json();

    if (!eventId || !feedback) {
      return NextResponse.json(
        { error: 'eventId and feedback are required' },
        { status: 400 }
      );
    }

    const event = getEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    updateEvent(eventId, { humanFeedback: feedback });
    addFeedback(
      eventId,
      feedback,
      event.responseDrafted || '',
      modifiedResponse
    );

    log(
      `Operator ${feedback} drafted response — learning signal recorded`,
      'success'
    );

    return NextResponse.json({
      recorded: true,
      feedback,
      message: `Learning signal recorded: ${feedback}. Future responses will adapt.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
