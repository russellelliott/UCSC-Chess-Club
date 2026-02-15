import Head from "next/head";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useAuth } from "@/lib/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const { user, login, logout, loading } = useAuth();

  return (
    <>
      <Head>
        <title>UCSC Chess Club</title>
        <meta name="description" content="UCSC Chess Club App" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}
      >
        <main className={styles.main}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <h1>UCSC Chess Club</h1>
            <div>
              {!loading && (
                user ? (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span>Hello, {user.displayName}</span>
                    <button onClick={logout} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Logout</button>
                    <button onClick={async () => {
                      // Test server-side auth
                      const token = await user.getIdToken();
                      const res = await fetch('/api/test-auth', {
                        headers: {
                          Authorization: `Bearer ${token}`
                        }
                      });
                      const data = await res.json();
                      console.log("Server auth response:", data);
                      alert(JSON.stringify(data, null, 2));
                    }}>Test Server Auth</button>
                  </div>
                ) : (
                  <button onClick={login} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Login</button>
                )
              )}
            </div>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <Link href="/ccl-search" style={{ fontSize: '1.2rem', color: '#007bff', textDecoration: 'underline' }}>
              Go to CCL Search Page
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
