import Head from "next/head";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
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
          <h1>UCSC Chess Club</h1>
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
