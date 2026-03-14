import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">COPS</h1>
        <p className="text-lg text-base-content/80">Confidential Onchain Payroll System</p>
        <p className="text-base-content/60 max-w-md">
          Pay employees in encrypted USDC. Salary amounts stay private on-chain using FHE.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/employer" className="btn btn-primary btn-lg">
          Employer Dashboard
        </Link>
        <Link href="/employee" className="btn btn-outline btn-lg">
          Employee Portal
        </Link>
      </div>
    </div>
  );
}
