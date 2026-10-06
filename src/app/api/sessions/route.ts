import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, updateSessionProfile } from "@/lib/db/sessions";
import { userProfileSchema } from "@/lib/schemas/userProfile";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userProfile = userProfileSchema.parse(body.userProfile ?? body);
    const session = await createSession(userProfile);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Unable to create session." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to read session:", error);
    return NextResponse.json({ error: "Unable to read session." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    const userProfile = userProfileSchema.parse(body.userProfile);

    if (!id) {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const session = await updateSessionProfile(id, userProfile);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json({ error: "Unable to update session." }, { status: 400 });
  }
}
