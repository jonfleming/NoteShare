import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function getNoteFilePath(id: string) {
  return path.join(process.cwd(), 'data', `${id}.json`);
}

async function calculateETag(content: string): Promise<string> {
  const hash = crypto.createHash('md5');
  hash.update(content);
  return `"${hash.digest('hex')}"`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = await getNoteFilePath(params.id);
    const content = await fs.readFile(filePath, 'utf-8');
    const etag = await calculateETag(content);
    
    // Check If-None-Match header for caching
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 }); // Not Modified
    }

    const response = NextResponse.json(JSON.parse(content));
    response.headers.set('ETag', etag);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const filePath = await getNoteFilePath(params.id);
    let currentContent = '';
    
    try {
      currentContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet, that's ok for new notes
    }
    
    const currentETag = await calculateETag(currentContent);
    const ifMatch = request.headers.get('If-Match');
    
    // Check for concurrent modifications
    if (ifMatch && ifMatch !== currentETag) {
      return NextResponse.json(
        { error: 'Content has been modified' },
        { status: 412 } // Precondition Failed
      );
    }
    
    const body = await request.json();
    await fs.writeFile(filePath, JSON.stringify(body, null, 2));
    
    const newETag = await calculateETag(JSON.stringify(body));
    const response = NextResponse.json({ success: true });
    response.headers.set('ETag', newETag);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save note' },
      { status: 500 }
    );
  }
}
