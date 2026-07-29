-- Allow German and Spanish as interface locales.
-- Question content for these locales is resolved to English in the app.

alter type public.app_locale add value if not exists 'de';
alter type public.app_locale add value if not exists 'es';
