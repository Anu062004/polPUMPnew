'use client'

import React from 'react'
import Link from 'next/link'
import { Twitter, MessageCircle, Send, ExternalLink } from 'lucide-react'

export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="relative z-10 border-t border-white/10 mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF4F84] to-[#8C52FF] flex items-center justify-center">
                                <span className="text-xl font-bold text-white">P</span>
                            </div>
                            <span className="text-xl font-bold text-white">POL Pump</span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Launch. Trade. Pump. The premier memecoin platform on Polygon.
                        </p>
                        <div className="flex items-center gap-1 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                Polygon Mainnet
                            </span>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Explore</h3>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/explore" className="text-gray-400 hover:text-white transition-colors text-sm">
                                    All Tokens
                                </Link>
                            </li>
                            <li>
                                <Link href="/gaming" className="text-gray-400 hover:text-white transition-colors text-sm">
                                    Gaming Arena
                                </Link>
                            </li>
                            <li>
                                <Link href="/profile" className="text-gray-400 hover:text-white transition-colors text-sm">
                                    My Portfolio
                                </Link>
                            </li>
                            <li>
                                <Link href="/creator" className="text-gray-400 hover:text-white transition-colors text-sm">
                                    Creator Dashboard
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Resources</h3>
                        <ul className="space-y-3">
                            <li>
                                <a
                                    href="https://docs.polpump.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors text-sm inline-flex items-center gap-1"
                                >
                                    Documentation
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://polygonscan.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors text-sm inline-flex items-center gap-1"
                                >
                                    PolygonScan
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                            <li>
                                <span className="text-gray-400 text-sm">API (Coming Soon)</span>
                            </li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Community</h3>
                        <div className="flex gap-3">
                            <a
                                href="https://twitter.com/polpump"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Twitter"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a
                                href="https://discord.gg/polpump"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Discord"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </a>
                            <a
                                href="https://t.me/polpump"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Telegram"
                            >
                                <Send className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-sm">
                        &copy; {currentYear} POL Pump. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                        <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
