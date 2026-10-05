// What the Security page reads, under the buyer's own session: the authenticator factors (Supabase Auth) and
// the live sessions (`account_sessions()`, 0115). Each read stands alone and a failed one is null, never an empty
// list: "Two-step is off" and "No other devices" must not be what an outage says. A database without 0115 has
// no `account_sessions`, which reads as a failed list, so the page says it could not load the devices.

import { parseDevices, parseFactors, type Device, type Factor } from "./model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function loadFactors(supabase: Client): Promise<Factor[] | null> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    return error ? null : parseFactors(data?.all);
  } catch {
    return null;
  }
}

export async function loadDevices(supabase: Client): Promise<Device[] | null> {
  try {
    const { data, error } = await supabase.rpc("account_sessions");
    return error ? null : parseDevices(data);
  } catch {
    return null;
  }
}
