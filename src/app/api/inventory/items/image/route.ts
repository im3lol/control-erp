import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

// POST /api/inventory/items/image - Upload item image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const itemId = formData.get('itemId') as string | null

    if (!file || !itemId) {
      return NextResponse.json(
        { error: 'الملف ومعرف الصنف مطلوبان' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. يُسمح بـ JPEG, PNG, WebP فقط' },
        { status: 400 }
      )
    }

    // Check if item exists
    const item = await db.item.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json(
        { error: 'الصنف غير موجود' },
        { status: 404 }
      )
    }

    // Read file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Resize to 400x400 using sharp
    const resizedBuffer = await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer()

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `${itemId}-${timestamp}.webp`

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'items')
    await mkdir(uploadDir, { recursive: true })

    // Write file
    const filePath = path.join(uploadDir, filename)
    await writeFile(filePath, resizedBuffer)

    // Update Item.image field
    const imagePath = `/uploads/items/${filename}`
    await db.item.update({
      where: { id: itemId },
      data: { image: imagePath },
    })

    return NextResponse.json({
      message: 'تم رفع الصورة بنجاح',
      imagePath,
    }, { status: 201 })
  } catch (error) {
    console.error('Upload item image error:', error)
    return NextResponse.json(
      { error: 'فشل في رفع الصورة' },
      { status: 500 }
    )
  }
}
