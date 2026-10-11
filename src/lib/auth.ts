import { supabase } from './supabase';

/** Where email links send people back to: this page, without the hash or query string. */
export const appUrl = () => location.origin + location.pathname;

export type SignUpResult = 'confirm' | 'exists' | 'signedin';

export async function signUp(email: string, password: string, name: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
  // With "Confirm email" on, Supabase answers an already-registered address with a user that has no identities.
  if (data.user && data.user.identities && data.user.identities.length === 0) return 'exists';
  return data.session ? 'signedin' : 'confirm';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } });
  if (error) throw new Error(error.message);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw new Error(error.message);
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
