// 📁 FILE PATH: app/dashboard/coffee/components/CoffeeSubNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlusCircle, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const NAV_ITEMS = [
  { label: 'Overview',   href: '/dashboard/coffee'              },
  { label: 'Plots',      href: '/dashboard/coffee/plots'        },
  { label: 'Activities', href: '/dashboard/coffee/activities'   },
  { label: 'Harvest',    href: '/dashboard/coffee/harvest'      },
  { label: 'Finance',    href: '/dashboard/coffee/finance'      },
  { label: 'EUDR',       href: '/dashboard/coffee/eudr-check'   },
  { label: 'Disease',    href: '/dashboard/coffee/disease'      },
  { label: 'Satellite',  href: '/dashboard/coffee/satellite'    },
]

const ACTIVITY_OPTIONS = [
  { label: 'Record harvest',  href: '/dashboard/coffee/harvest/record'                          },
  { label: 'Weeding',         href: '/dashboard/coffee/activities/record?type=weeding'          },
  { label: 'Fertilizer',      href: '/dashboard/coffee/activities/record?type=nutrition'        },
  { label: 'Spraying',        href: '/dashboard/coffee/activities/record?type=crop_protection'  },
  { label: 'Pruning',         href: '/dashboard/coffee/activities/record?type=pruning'          },
  { label: 'Mulching',        href: '/dashboard/coffee/activities/record?type=mulching'         },
  { label: 'Other activity',  href: '/dashboard/coffee/activities/record?type=other'            },
  { label: 'Add plot',        href: '/dashboard/coffee/plots/add'                               },
]

export default function CoffeeSubNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="border-b border-[#2A2D35] bg-[#0A0C10] sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map(({ label, href }) => {
              const active = href === '/dashboard/coffee'
                ? pathname === href
                : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    active
                      ? 'text-white bg-white/10'
                      : 'text-[#6B7280] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="relative flex-shrink-0 ml-2" ref={ref}>
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors"
            >
              <PlusCircle size={12} />
              Record activity
              <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-[#2A2D35] bg-[#0D0F14] shadow-xl z-50 py-1">
                <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-[#4B5563] uppercase tracking-widest">Select activity</p>
                {ACTIVITY_OPTIONS.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}