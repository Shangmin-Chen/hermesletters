import "server-only";

import { NextResponse } from "next/server";

export function v2Error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
