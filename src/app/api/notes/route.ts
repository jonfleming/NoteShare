import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dataDirectory = path.join(process.cwd(), 'data');
    const files = await fs.readdir(dataDirectory);
    const noteIds = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    return NextResponse.json(noteIds);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
