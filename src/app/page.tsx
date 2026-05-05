import Link from "next/link";
import { ArrowRight, Bot, FileText, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Looma</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Build Apps with
            <span className="text-primary"> AI </span>
            Intelligence
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The zero-code platform that combines traditional SaaS capabilities
            with AI-powered interactions. Create forms, workflows, and AI agents
            through natural language and visual drag-and-drop.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Building <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Zero-Code Forms</CardTitle>
                <CardDescription>
                  Build professional forms with drag-and-drop. No coding required.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <GitBranch className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Visual Workflows</CardTitle>
                <CardDescription>
                  Create automated business processes with our visual workflow editor.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Bot className="h-10 w-10 text-primary mb-2" />
                <CardTitle>AI Agents</CardTitle>
                <CardDescription>
                  Build intelligent AI agents that understand and respond to your needs.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2026 Looma. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
