import type { Metadata } from "next";
import { SignInClient } from "./sign-in-client";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Aster University student portal.",
};

export default function SignInPage() {
  return <SignInClient />;
}
