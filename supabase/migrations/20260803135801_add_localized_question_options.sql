-- Official katalog columns: Pytanie [EN]/[D]/[UA] and Odpowiedź A/B/C [EN]/[D]/[UA].
-- Keep Polish option_a/b/c as the canonical answer text used by answer_type checks.

alter table public.questions
  add column if not exists question_de text,
  add column if not exists option_a_ua text,
  add column if not exists option_b_ua text,
  add column if not exists option_c_ua text,
  add column if not exists option_a_en text,
  add column if not exists option_b_en text,
  add column if not exists option_c_en text,
  add column if not exists option_a_de text,
  add column if not exists option_b_de text,
  add column if not exists option_c_de text;

comment on column public.questions.question_de is
  'Official German question text from katalog Pytanie [D].';
comment on column public.questions.option_a_ua is
  'Official Ukrainian option A from katalog Odpowiedź A [UA].';
comment on column public.questions.option_b_ua is
  'Official Ukrainian option B from katalog Odpowiedź B [UA].';
comment on column public.questions.option_c_ua is
  'Official Ukrainian option C from katalog Odpowiedź C [UA].';
comment on column public.questions.option_a_en is
  'Official English option A from katalog Odpowiedź A [EN].';
comment on column public.questions.option_b_en is
  'Official English option B from katalog Odpowiedź B [EN].';
comment on column public.questions.option_c_en is
  'Official English option C from katalog Odpowiedź C [EN].';
comment on column public.questions.option_a_de is
  'Official German option A from katalog Odpowiedź A [D].';
comment on column public.questions.option_b_de is
  'Official German option B from katalog Odpowiedź B [D].';
comment on column public.questions.option_c_de is
  'Official German option C from katalog Odpowiedź C [D].';
