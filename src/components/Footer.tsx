'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HeartHandshake, FileText, Lock, ReceiptText, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-neutral-850 bg-neutral-950/80 backdrop-blur-md mt-auto text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Privacy Statement */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="vectorizerr logo"
                className="h-7 w-7 rounded-lg shadow shadow-indigo-500/20 object-contain"
              />
              <span className="font-bold text-white text-base tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                vectorizerr
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-md">
              High-performance, private in-browser raster to vector graphics (SVG) studio.
              All image tracing occurs 100% locally on your device inside a WebAssembly sandbox.
              Your images are never transmitted or stored on remote servers.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>100% In-Browser Private Processing & Cryptographic Integrity</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Vectorizer Studio</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/transactions"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <ReceiptText className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Crypto Transactions</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <HeartHandshake className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Contact & Support</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Policy */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
              Legal & Safety
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/privacy"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <Lock className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <FileText className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Conditions of Use</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/support?category=crypto_transaction"
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition"
                >
                  <span>Transaction Assistance</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-850/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
          <div>
            &copy; {new Date().getFullYear()} vectorizerr. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-neutral-300 transition">
              Privacy
            </Link>
            <span className="text-neutral-800">•</span>
            <Link href="/terms" className="hover:text-neutral-300 transition">
              Terms & Conditions
            </Link>
            <span className="text-neutral-800">•</span>
            <Link href="/support" className="hover:text-neutral-300 transition">
              Support Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
