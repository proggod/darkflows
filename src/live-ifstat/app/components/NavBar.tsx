import Link from 'next/link'
import Image from 'next/image'

export default function NavBar() {
  return (
    <nav className="fixed top-0 w-full bg-[#111111]/95 backdrop-blur supports-[backdrop-filter]:bg-[#111111]/60 z-50">
      <div className="relative flex h-12 items-center px-4">
        {/* Left - Logo */}
        <div className="flex items-center">
          <Link 
            href="https://darkflows.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <Image 
              src="/darkflows-logo.svg" 
              alt="DarkFlows Logo" 
              width={180}
              height={45}
              priority={true}
              className="dark:invert-0"
            />
          </Link>
        </div>

        {/* Center - Description */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            A simple, easy to use elegant open source router interface
          </p>
        </div>
      </div>
    </nav>
  )
} 