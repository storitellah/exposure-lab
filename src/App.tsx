/** Route table. Pages are lazy-loaded to keep the initial bundle small. */
import { lazy, Suspense, Component, useEffect, type ReactNode } from 'react';
import { useRouter } from './router';
import { Layout } from './components/Layout';
import { useI18n } from './i18n';
import { applyRouteMeta } from './seo';

const Home = lazy(() => import('./pages/Home'));
const Learn = lazy(() => import('./pages/Learn'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const Challenges = lazy(() => import('./pages/Challenges'));
const Gallery = lazy(() => import('./pages/Gallery'));
const PrintStudio = lazy(() => import('./pages/PrintStudio'));
const Teacher = lazy(() => import('./pages/Teacher'));
const Glossary = lazy(() => import('./pages/Glossary'));
const AccessibilityPage = lazy(() => import('./pages/AccessibilityPage'));
const Privacy = lazy(() => import('./pages/Privacy'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const About = lazy(() => import('./pages/About'));
const Support = lazy(() => import('./pages/Support'));
const MyCamera = lazy(() => import('./pages/MyCamera'));

class ErrorBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <p className="notice error" role="alert">{this.props.message}</p>;
    }
    return this.props.children;
  }
}

export function App() {
  const { path } = useRouter();
  const { t } = useI18n();

  // Keep the document title, description and canonical URL in step with the
  // route, so shared links and browser history are meaningful.
  useEffect(() => { applyRouteMeta(path); }, [path]);

  const page = () => {
    if (path === '/' || path === '') return <Home />;
    if (path.startsWith('/learn')) return <Learn />;
    if (path.startsWith('/simulator')) return <SimulatorPage />;
    if (path.startsWith('/video')) return <VideoPage />;
    if (path.startsWith('/challenges')) return <Challenges />;
    if (path.startsWith('/gallery')) return <Gallery />;
    if (path.startsWith('/print')) return <PrintStudio />;
    if (path.startsWith('/teacher')) return <Teacher />;
    if (path.startsWith('/glossary')) return <Glossary />;
    if (path.startsWith('/accessibility')) return <AccessibilityPage />;
    if (path.startsWith('/privacy')) return <Privacy />;
    if (path.startsWith('/security')) return <SecurityPage />;
    if (path.startsWith('/about')) return <About />;
    if (path.startsWith('/support')) return <Support />;
    if (path.startsWith('/my-camera')) return <MyCamera />;
    return <Home />;
  };

  return (
    <Layout>
      <ErrorBoundary message={t('errorGeneric')}>
        <Suspense fallback={<p role="status">{t('loading')}</p>}>{page()}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
