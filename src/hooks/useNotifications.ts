import { useEffect } from 'react';
import { Medicine } from '../types';

export function useNotifications(medicines: Medicine[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    medicines.forEach(med => {
      const times = med.doseTimes?.length ? med.doseTimes : [med.doseTime];
      times.forEach(t => {
        if (!t) return;
        // Skip times already taken today
        if (med.takenTimes?.includes(t)) return;

        const [h, m] = t.split(':').map(Number);
        const dose = new Date();
        dose.setHours(h, m, 0, 0);
        const msUntil = dose.getTime() - Date.now();
        if (msUntil <= 0) return;

        const timer = setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification('💊 Time for your medication!', {
              body: `Take ${med.doseQuantity} tab(s) of ${med.name}`,
              icon: '/favicon.svg',
              badge: '/favicon.svg',
              tag: `${med.id}-${t}`,
            });
          }
        }, msUntil);

        timers.push(timer);
      });
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [medicines, enabled]);
}
