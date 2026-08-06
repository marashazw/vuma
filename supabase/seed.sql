-- Optional starter subscription plans. Edit prices freely from the admin
-- dashboard afterwards — this just gives you something to launch with.

insert into subscription_plans (name, country, period, price, currency, commission_pct_while_active, is_active)
values
  ('ZA Weekly Unlimited', 'ZA', 'weekly', 149.00, 'ZAR', 0, true),
  ('ZA Monthly Unlimited', 'ZA', 'monthly', 499.00, 'ZAR', 0, true),
  ('ZA Weekly Reduced-Commission', 'ZA', 'weekly', 69.00, 'ZAR', 4, true),
  ('ZW Weekly Unlimited', 'ZW', 'weekly', 8.00, 'USD', 0, true),
  ('ZW Monthly Unlimited', 'ZW', 'monthly', 28.00, 'USD', 0, true),
  ('ZW Weekly Reduced-Commission', 'ZW', 'weekly', 3.50, 'USD', 3, true)
on conflict do nothing;
