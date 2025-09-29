// @/schemas/mpesa
import z from "zod";

// Zod schema
export const formSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^(?:254|\+254|0)\d{9}$/, "Enter a valid Safaricom number"),
  amount: z.string().min(1, "Amount must be at least 1 KES"),
});

export type FormData = z.infer<typeof formSchema>;
