import { NextRequest, NextResponse } from "next/server";
import { createConversation, getConversation } from "@/lib/db/conversations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const conversation = await createConversation({
      sessionId: String(body.sessionId),
      title: body.title ?? null,
      primaryTopic: body.primaryTopic ?? null,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json({ error: "Unable to create conversation." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Conversation id is required." }, { status: 400 });
    }

    const conversation = await getConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Failed to read conversation:", error);
    return NextResponse.json({ error: "Unable to read conversation." }, { status: 500 });
  }
}
