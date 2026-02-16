import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const ALLOWED_GENRES = [
  "Keyboard",
  "Chamber",
  "Orchestra",
  "Ballet",
  "Opera",
  "Choral",
  "Electroacoustic",
  "World",
  "Other",
];

const MAX_DESCRIPTION = 280;
const MAX_NAME = 100;
const MAX_OTHER_GENRE = 100;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory rate limiter (resets on redeploy)
const ipTimestamps = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  ipTimestamps.set(ip, recent);

  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  ipTimestamps.set(ip, recent);
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { description, genre, otherGenre, name } = body;

    // Validate description
    if (
      typeof description !== "string" ||
      description.trim().length === 0 ||
      description.trim().length > MAX_DESCRIPTION
    ) {
      return NextResponse.json(
        { error: `Description must be 1–${MAX_DESCRIPTION} characters.` },
        { status: 400 }
      );
    }

    // Validate genre
    if (typeof genre !== "string" || !ALLOWED_GENRES.includes(genre)) {
      return NextResponse.json(
        { error: "Invalid genre selection." },
        { status: 400 }
      );
    }

    // Validate otherGenre when genre is "Other"
    if (genre === "Other") {
      if (
        typeof otherGenre !== "string" ||
        otherGenre.trim().length === 0 ||
        otherGenre.trim().length > MAX_OTHER_GENRE
      ) {
        return NextResponse.json(
          {
            error: `Please specify a genre (1–${MAX_OTHER_GENRE} characters).`,
          },
          { status: 400 }
        );
      }
    }

    // Validate name (optional)
    if (name !== undefined && name !== null) {
      if (typeof name !== "string" || name.trim().length > MAX_NAME) {
        return NextResponse.json(
          { error: `Name must be at most ${MAX_NAME} characters.` },
          { status: 400 }
        );
      }
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const resolvedGenre =
      genre === "Other" ? otherGenre.trim() : genre;
    const resolvedName =
      name && typeof name === "string" && name.trim() ? name.trim() : "Anonymous";

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            resolvedName,
            resolvedGenre,
            description.trim(),
          ],
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Failed to save submission. Please try again." },
      { status: 500 }
    );
  }
}
