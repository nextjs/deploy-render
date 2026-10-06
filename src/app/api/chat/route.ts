import { NextRequest, NextResponse } from "next/server";
import { handleChatRequest, ChatServiceError } from "@/lib/chat/service";
import { defaultChatDependencies } from "@/lib/chat/defaultDependencies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await handleChatRequest(body, defaultChatDependencies);
    return NextResponse.json(response, { status: response.status === "error" ? 500 : 200 });
  } catch (error) {
    if (error instanceof ChatServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[RASHID chat] unexpected route failure", error);
    return NextResponse.json({ error: "Unable to complete chat request." }, { status: 500 });
  }
}
