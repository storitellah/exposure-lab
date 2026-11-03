/** About page: the name, the mission, the disclaimer. */
import { useI18n } from '../i18n';
import { Wordmark } from '../components/Wordmark';
import { StoritellahLink } from '../components/StoritellahLink';
import { CATALOGUE_VERSION } from '../data/catalogue';
import { APP_VERSION } from '../version';

export default function About() {
  const { t } = useI18n();
  return (
    <div className="content-page">
      <h1>{t('navAbout')}</h1>
      <p style={{ textAlign: 'center' }}><Wordmark size={80} /></p>
      <p>{t('tatuMeaning')}</p>
      <p>
        Tatu Exposure Lab by <StoritellahLink /> is an interactive exposure triangle simulator for
        young photographers, photography students, teachers, beginners and visual
        storytellers. It teaches how aperture, shutter speed and ISO work — independently
        and together — through direct experimentation: every change you make produces a
        visible result.
      </p>
      <p>
        It was designed for photographers aged roughly 10 to 19, and for the teachers,
        clubs, schools and trainers who work with them — while staying genuinely useful to
        adults learning photography and video.
      </p>
      <h2>Independence</h2>
      <p>{t('independentNote')}</p>
      <p>{t('educationalApprox')}</p>
      <h2>Versions</h2>
      <p>App {APP_VERSION} · Camera &amp; lens catalogue {CATALOGUE_VERSION}</p>
    </div>
  );
}
