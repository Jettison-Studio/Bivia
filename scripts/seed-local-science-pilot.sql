-- Local editorial pilot approved in conversation; sources in docs/content/science-pilot.md.
-- Run only against supabase_db_Bivia. Existing attempts retain their question snapshots.
begin;
insert into public.quizzes(id,category_id,title,description,status,publish_at)
values ('42000000-0000-4000-8000-000000000001','science','Small wonders','Five questions. A little food for thought.','published',now())
on conflict(id) do nothing;
insert into private.questions(quiz_id,position,prompt,options,correct_index,hint,hint_reference,explanation) values
 ('42000000-0000-4000-8000-000000000001',0,'Which shape can cover a flat surface with identical regular tiles and no gaps?',to_jsonb(ARRAY['Circle','Regular pentagon','Regular hexagon','Regular octagon']),2,'Eat honey, my son','Proverbs 24:13 · NIV excerpt','Regular hexagons fit edge to edge without gaps, as in a honeycomb.'),
 ('42000000-0000-4000-8000-000000000001',1,'A puddle disappears on a dry afternoon without boiling. Which process explains it?',to_jsonb(ARRAY['Condensation','Evaporation','Freezing','Precipitation']),1,'yet the sea is never full','Ecclesiastes 1:7 · NIV excerpt','Evaporation turns liquid water into vapor at the surface, without requiring boiling.'),
 ('42000000-0000-4000-8000-000000000001',2,'What do we call the separation of white light into its component colors?',to_jsonb(ARRAY['Absorption','Polarization','Diffraction','Dispersion']),3,'my rainbow in the clouds','Genesis 9:13 · NIV excerpt','Dispersion separates light by wavelength, producing its component colors.'),
 ('42000000-0000-4000-8000-000000000001',3,'Which type of chemical bond holds positive and negative ions together through electrical attraction?',to_jsonb(ARRAY['Ionic','Covalent','Metallic','Hydrogen']),0,'salt of the earth','Matthew 5:13 · NIV excerpt','Ionic bonding is the electrical attraction between oppositely charged ions. Table salt is a familiar example.'),
 ('42000000-0000-4000-8000-000000000001',4,'Which chemical messengers can leave a trail that guides other members of a colony toward food?',to_jsonb(ARRAY['Antibodies','Enzymes','Pheromones','Pigments']),2,'Go to the ant','Proverbs 6:6 · NIV excerpt','Trail pheromones can guide nestmates to food. Many ants use this form of chemical communication.')
on conflict(quiz_id,position) do nothing;
update public.daily_rounds set quiz_id='42000000-0000-4000-8000-000000000001'
where edition_day=(now() at time zone 'UTC')::date and mode='category' and category_id='science';
insert into public.daily_rounds(edition_day,mode,category_id,quiz_id)
values ((now() at time zone 'UTC')::date,'category','science','42000000-0000-4000-8000-000000000001')
on conflict do nothing;
commit;
