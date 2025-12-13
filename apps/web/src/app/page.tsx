"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import {
  Music,
  Headphones,
  Sparkles,
  Zap,
  Volume2,
  ListMusic,
  Play,
  SkipForward,
  Github,
  Bot,
  PartyPopper,
  Flame,
  Skull,
  Heart,
} from "lucide-react";

const features = [
  {
    icon: Music,
    title: "plays music fr fr",
    description: "no cap, it actually plays bangers from youtube, spotify, soundcloud. mid-free zone only.",
    emoji: "🎵",
  },
  {
    icon: ListMusic,
    title: "queue goes brrrr",
    description: "unlimited queue bc we're not broke. add songs till your ram dies.",
    emoji: "📝",
  },
  {
    icon: Volume2,
    title: "audio filters lowkey fire",
    description: "bass boost, nightcore, 8d audio... make it sound different ig idk.",
    emoji: "🔊",
  },
  {
    icon: Sparkles,
    title: "lyrics on god",
    description: "karaoke mode activated. sing off-key in peace bestie.",
    emoji: "✨",
  },
  {
    icon: Zap,
    title: "fast as my attention span",
    description: "low latency playback. no buffer, no waiting.",
    emoji: "⚡",
  },
  {
    icon: Play,
    title: "web dashboard slay",
    description: `control everything from browser. it's giving ${new Date().getFullYear()}. touch grass later.`,
    emoji: "🖥️",
  },
];

const stats = [
  { label: "lines of spaghetti code", value: "∞", emoji: "🍝" },
  { label: "bugs we call features", value: "99+", emoji: "🐛" },
  { label: "developers (me)", value: "1", emoji: "🤡" },
  { label: "hours of sleep lost", value: "yes", emoji: "💀" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* floating emojis background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-emoji absolute text-6xl top-[10%] left-[5%] animate-bounce-slow opacity-20">
          🎵
        </div>
        <div className="floating-emoji absolute text-4xl top-[20%] right-[10%] animate-spin-slow opacity-20">
          💿
        </div>
        <div className="floating-emoji absolute text-5xl bottom-[30%] left-[15%] animate-pulse opacity-20">
          🎧
        </div>
        <div className="floating-emoji absolute text-3xl top-[60%] right-[20%] animate-bounce-slow opacity-20">
          🔥
        </div>
        <div className="floating-emoji absolute text-4xl bottom-[10%] right-[5%] animate-wiggle opacity-20">
          💀
        </div>
        <div className="floating-emoji absolute text-5xl top-[40%] left-[80%] animate-pulse opacity-20">
          ✨
        </div>
      </div>

      {/* nav */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary animate-wiggle" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent">
              dumbbot
            </span>
            <Badge variant="secondary" className="ml-2 animate-pulse">
              <Skull className="h-3 w-3 mr-1" />
              certified silly
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <Link
              href="https://github.com/renzynx/dumbbot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <Github className="h-4 w-4 mr-2" />
                sauce
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="container mx-auto px-4 py-20 md:py-32 relative">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-6 text-sm px-4 py-1 animate-bounce">
            <PartyPopper className="h-4 w-4 mr-2" />
            version: trust me bro
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-primary via-pink-500 to-orange-500 bg-clip-text text-transparent animate-gradient">
              dumbbot
            </span>
            <br />
            <span className="text-foreground">
              a music bot
              <br />
              that just works
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            it plays music in your discord server and has a dashboard i guess.
            no thoughts, just vibes. built different (in a bad way).
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 group">
                <Headphones className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                open dashboard
                <Flame className="h-5 w-5 ml-2 text-orange-400" />
              </Button>
            </Link>
            <Link
              href="https://github.com/renzynx/dumbbot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg" className="text-lg px-8">
                <Github className="h-5 w-5 mr-2" />
                steal my code
              </Button>
            </Link>
          </div>

          {/* silly warning */}
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
            <Skull className="h-4 w-4" />
            <span>side effects include mass brainrot</span>
            <Skull className="h-4 w-4" />
          </div>
        </div>
      </section>

      {/* stats - silly */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center hover:scale-105 transition-transform duration-300 border-2 hover:border-primary">
              <CardContent className="pt-6">
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            features that kinda work
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            what can this thing do?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            honestly? more than you'd expect from something called "dumbbot"
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:scale-105 transition-all duration-300 hover:shadow-xl hover:border-primary cursor-pointer"
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      {feature.title}
                      <span className="text-xl">{feature.emoji}</span>
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary/20 via-pink-500/20 to-orange-500/20 border-2 border-primary/50">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="text-6xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ready to make some noise?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
              stop reading and start vibing. your discord server is waiting.
              (it's free, we're not that dumb)
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8 group">
                  <SkipForward className="h-5 w-5 mr-2 group-hover:translate-x-1 transition-transform" />
                  let's goooo
                </Button>
              </Link>
            </div>

            {/* trust badges but silly */}
            <div className="flex flex-wrap justify-center gap-4 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4 text-red-500" /> made with tears
              </span>
              <span className="flex items-center gap-1">
                <Skull className="h-4 w-4" /> 0% tested
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-500" /> lowkey fire
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <span className="font-semibold">dumbbot</span>
              <span className="text-muted-foreground">• built different (derogatory)</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link
                href="https://github.com/renzynx/dumbbot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Github className="h-4 w-4" />
                github
              </Link>
              <span>|</span>
              <span>© {new Date().getFullYear()} or whatever</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
