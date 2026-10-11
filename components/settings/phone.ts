// Class strings the phone Settings pages share (Paper `11 · Settings`), kept out of a "use client" file
// so a server page reads them as strings. From 768 they add nothing.

/** A field: 48 tall, radius 8, 14 in, 16 type. */
export const PHONE_INPUT = "max-md:h-input-touch max-md:rounded-lg max-md:px-3.5 max-md:text-md";

/** Paper's phone button on a Settings page: a 44 sunken pill at the start of the line, whatever its kind from 768. */
export const PHONE_PILL =
  "max-md:h-11 max-md:w-auto max-md:rounded-full max-md:border-0 max-md:bg-sunken max-md:px-3.5 max-md:text-base max-md:text-ink max-md:hover:bg-sunken max-md:active:bg-line max-md:disabled:text-disabled max-md:aria-disabled:text-disabled";
