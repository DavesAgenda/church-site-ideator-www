"use client";
import dynamic from "next/dynamic";
const Inner = dynamic(() => import("./MapView.client"), { ssr: false });
export default function MapView() { return <Inner />; }
