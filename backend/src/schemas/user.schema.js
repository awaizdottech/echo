import {z} from zod

const fileSchema=z.object({
    mimetype: z.enum(['image/jpeg', 'image/png', 'application/pdf']), // Allowed MIME types
    size: z.number().max(5 * 1024 * 1024),  // Max file size 5MB
    originalname: z.string().regex(/\.(jpg|jpeg|png|pdf)$/i), // Allowed file extensions
  });

export const userSchema=z.object({
    username:z.string().toLowerCase().trim().min(8).max(15, { message: "it cannot be empty" }),
    email:z.email({ message: "it cannot be empty" }),
    fullname:z.string().toLowerCase().trim().min(8).max(15, { message: "it cannot be empty" }),
    avatar:fileSchema,
    coverImage:fileSchema,
    password:z.string().trim().min(8).max(15, { message: "it cannot be empty" }),
    refreshToken:z.string()
})