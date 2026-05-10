import useTripStore from '../stores/tripStore';
import { translations } from '../locales';

export const useTranslation = () => {
  const language = useTripStore((state) => state.language);
  
  const t = (path) => {
    const keys = path.split('.');
    
    // Attempt to get the string in the current language
    let result = translations[language];
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key];
      } else {
        result = undefined;
        break;
      }
    }

    // If string not found in current language, fallback to English
    if (result === undefined && language !== 'en') {
      result = translations['en'];
      for (const key of keys) {
        if (result && result[key] !== undefined) {
          result = result[key];
        } else {
          result = undefined;
          break;
        }
      }
    }

    return result || path; // Return the path itself if no translation is found
  };

  return { t, language };
};
