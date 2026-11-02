import { useEffect } from 'react';

export function TitleManager() {
  useEffect(() => {
    document.title = __APP_NAME__;
  }, []);

  return null;
}
