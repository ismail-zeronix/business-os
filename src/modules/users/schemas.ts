import { z } from "zod";
import { requiredText } from "../../core/validation/fields";
import { UserRole } from "../../generated/prisma/enums";

export const MIN_PASSWORD = 10;

/** A password is long, not clever: at least 10 characters. It is stored hashed and never shown again. */
const password = (label = "Password") =>
  z
    .string({ error: `Enter a ${label.toLowerCase()}` })
    .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
    .max(200, "That is too long");

const email = z
  .string({ error: "Enter an email address" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254, "That is too long"));

const roles = Object.values(UserRole) as [UserRole, ...UserRole[]];

/** Never the same as the person's email address, and (where there are two fields) typed the same twice. */
const notTheEmail = { message: "Do not use your email address as the password", path: ["password"] };

export const signInSchema = z.object({
  email,
  /** Not length-checked here: an old password must still be accepted; only new passwords have a minimum. */
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(200),
  next: z.string().max(500).optional(),
});

export const setupSchema = z
  .object({ name: requiredText("Name", 120), email, password: password(), confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "The two passwords are not the same", path: ["confirmPassword"] })
  .refine((v) => v.password.toLowerCase() !== v.email, notTheEmail);

export const changePasswordSchema = z
  .object({ currentPassword: z.string({ error: "Enter your current password" }).min(1, "Enter your current password").max(200), newPassword: password("New password"), confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "The two passwords are not the same", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Choose a password you have not used just now", path: ["newPassword"] });

export const userCreateSchema = z
  .object({ name: requiredText("Name", 120), email, role: z.enum(roles, { error: "Choose a role" }), password: password("Initial password") })
  .refine((v) => v.password.toLowerCase() !== v.email, notTheEmail);

export const userUpdateSchema = z.object({ id: z.uuid(), name: requiredText("Name", 120), email, role: z.enum(roles, { error: "Choose a role" }) });

export const userPasswordResetSchema = z.object({ id: z.uuid(), password: password("New password") });

export const userStatusSchema = z.object({ id: z.uuid(), status: z.enum(["ACTIVE", "INACTIVE"], { error: "Choose Active or Inactive" }) });

export type SignInInput = z.output<typeof signInSchema>;
export type SetupInput = z.output<typeof setupSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export type UserCreateInput = z.output<typeof userCreateSchema>;
export type UserUpdateInput = z.output<typeof userUpdateSchema>;
export type UserPasswordResetInput = z.output<typeof userPasswordResetSchema>;
export type UserStatusInput = z.output<typeof userStatusSchema>;
