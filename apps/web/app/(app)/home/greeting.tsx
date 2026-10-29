"use client";

// ui-03: "Good morning, Aditi". The hour is the reader's own, so the server renders "Hi" and the browser swaps in
// the time of day once mounted.
import { useEffect, useState } from "react";
import { greeting } from "@/lib/kitchen";

export function Greeting({ name }: { name: string | null }) {
  const [hello, setHello] = useState("Hi");
  useEffect(() => setHello(greeting(new Date().getHours())), []);
  return (
    <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
      {name ? `${hello}, ${name}` : hello}
    </h1>
  );
}
