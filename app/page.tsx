import SubmissionForm from "./components/SubmissionForm";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <main className="w-full max-w-[600px]">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            What classical music should exist?
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Describe a piece you&apos;d love to hear in one sentence. The best
            ideas will inspire commissions from real composers.
          </p>
        </header>
        <SubmissionForm />
      </main>
    </div>
  );
}
