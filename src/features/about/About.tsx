import { Link } from 'react-router-dom';
import { PageContainer } from '../../shared/ui/PageContainer';

export default function About() {
  return (
    <PageContainer>
      <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          About British Cycling Club Viewer
        </h2>

        <section className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Overview</h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            A community-built dashboard for British Cycling club race results. Browse clubs, drill
            into individual riders, compare riders side by side, and view aggregated club summaries
            with year-over-year trends — all sourced directly from the official British Cycling
            results pages.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">What You Can Do</h3>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300 space-y-1">
            <li>
              <Link to="/" className="text-blue-500 hover:underline">
                Browse clubs
              </Link>{' '}
              tracked in the system.
            </li>
            <li>View every rider for a club with filtering by name, category and discipline.</li>
            <li>
              See a{' '}
              <span className="font-medium text-gray-700 dark:text-gray-200">club summary</span>{' '}
              with totals, regional/national splits, category breakdowns, and an optional
              year-over-year comparison.
            </li>
            <li>
              <Link to="/compare" className="text-blue-500 hover:underline">
                Compare riders
              </Link>{' '}
              head-to-head across disciplines.
            </li>
            <li>Toggle light/dark mode and use the app comfortably on mobile or desktop.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">How It Works</h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            The backend scrapes each rider&apos;s race history from the British Cycling website,
            de-duplicates events by ID, and exposes a small JSON API consumed by this React app.
            All aggregate statistics — points totals, race counts, category splits — are computed
            client-side from that data so the same dataset can power multiple views without extra
            requests.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">
            Caching &amp; Freshness
          </h3>
          <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <p className="mb-2">
              British Cycling rate-limits aggressively, so results are cached at two levels: an
              in-memory layer for hot reads and a disk layer that survives restarts.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-gray-700 dark:text-gray-200">Current year</span> —
                10 minutes in development, 24 hours in production.
              </li>
              <li>
                <span className="font-medium text-gray-700 dark:text-gray-200">Previous years</span>{' '}
                — cached indefinitely (results don&apos;t change retroactively).
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Data Accuracy</h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            All numbers come straight from British Cycling. If a result is missing, miscategorised,
            or attributed to the wrong rider on their site, it will appear the same way here. This
            project does not edit, override, or moderate the underlying data.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">
            Source &amp; Issues
          </h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 mb-3">
            The project is open source. Bug reports, suggestions and pull requests are welcome.
          </p>
          <a
            href="https://github.com/linal/mitre-riders"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline inline-flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub Repository
          </a>
        </section>
      </div>
    </PageContainer>
  );
}
