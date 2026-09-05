-- Original development fixtures, not imported WordPress content. Do not use as a launch content library.
insert into public.categories(id,name,icon,color,description,sort_order) values
 ('geography','Geography','globe','#3F7D7C','A little wonder around the world.',0),
 ('science','Science','flask','#6C73B8','Discover the extraordinary in the everyday.',1),
 ('history','History','hourglass','#BB8848','Big moments. Curious stories.',2),
 ('food','Food & Drink','restaurant','#CE543C','A fresh serving of curiosity.',3),
 ('nature','Nature','leaf','#68966B','Explore our remarkable living world.',4),
 ('entertainment','Entertainment','film','#B47596','Stories, songs, and the things we love.',5)
on conflict(id) do nothing;
insert into public.quizzes(id,category_id,title,description,status,publish_at) values
 ('10000000-0000-4000-8000-000000000001','geography','A world of wonder','Five places. Five clever clues. How far will you go?','published','2026-01-01'),
 ('10000000-0000-4000-8000-000000000002','science','Small things, big discoveries','Everyday science, with a little inspiration.','published','2026-01-01'),
 ('10000000-0000-4000-8000-000000000003','food','Food for thought','Taste your way through a fresh set of questions.','published','2026-01-01')
on conflict(id) do nothing;
insert into private.questions(quiz_id,position,prompt,options,correct_index,hint,hint_reference,explanation) values
 ('10000000-0000-4000-8000-000000000001',0,'Which country is home to the city of Kyoto?','["Japan","Peru","Greece","Egypt"]',0,'Think of a land far toward the rising sun.','Psalm 113:3','Kyoto was Japan’s capital for more than a thousand years.'),
 ('10000000-0000-4000-8000-000000000001',1,'Which ocean is the largest?','["Atlantic","Indian","Pacific","Arctic"]',2,'The sea is vast and filled with living things.','Psalm 104:25','The Pacific is the largest and deepest ocean.'),
 ('10000000-0000-4000-8000-000000000001',2,'What is the capital city of Italy?','["Milan","Rome","Venice","Florence"]',1,'Paul longed to visit the believers in this city.','Romans 1:15','Rome is Italy’s capital.'),
 ('10000000-0000-4000-8000-000000000001',3,'Which river flows through Egypt?','["Amazon","Thames","Danube","Nile"]',3,'A baby in a basket was placed among the reeds along this river.','Exodus 2:3','The Nile flows north through Egypt to the Mediterranean Sea.'),
 ('10000000-0000-4000-8000-000000000001',4,'Which continent has no permanent native human population?','["Europe","Antarctica","Asia","Africa"]',1,'Consider a place of snow and storehouses of hail.','Job 38:22','Antarctica has research stations but no permanent native population.'),
 ('10000000-0000-4000-8000-000000000002',0,'What do bees collect from flowers to make honey?','["Salt","Nectar","Dew","Seeds"]',1,'Sweetness from the honeycomb brings delight.','Proverbs 16:24','Bees collect nectar and convert it into honey.'),
 ('10000000-0000-4000-8000-000000000002',1,'Which planet is known as the Red Planet?','["Venus","Jupiter","Mars","Neptune"]',2,'Look up and consider the work of the heavens.','Psalm 19:1','Iron minerals on Mars oxidize, giving it a reddish appearance.'),
 ('10000000-0000-4000-8000-000000000002',2,'What gas do plants take in during photosynthesis?','["Carbon dioxide","Helium","Hydrogen","Neon"]',0,'Green plants were given a place upon the earth.','Genesis 1:11','Plants use light, water, and carbon dioxide to produce sugars.'),
 ('10000000-0000-4000-8000-000000000002',3,'What is frozen water called?','["Steam","Mist","Ice","Vapor"]',2,'The waters become hard as stone in the cold.','Job 38:30','Ice is the solid state of water.'),
 ('10000000-0000-4000-8000-000000000002',4,'How many legs does an insect have?','["Four","Six","Eight","Ten"]',1,'Observe the ant and learn from its ways.','Proverbs 6:6','Adult insects have three pairs of legs, for a total of six.'),
 ('10000000-0000-4000-8000-000000000003',0,'Which fruit is traditionally dried to make raisins?','["Apples","Plums","Grapes","Figs"]',2,'The vine bears this familiar fruit.','John 15:5','Raisins are dried grapes.'),
 ('10000000-0000-4000-8000-000000000003',1,'Which ingredient helps bread dough rise?','["Yeast","Salt","Oil","Water"]',0,'A little of this works through a whole batch of dough.','Matthew 13:33','Yeast produces carbon dioxide during fermentation, helping dough rise.'),
 ('10000000-0000-4000-8000-000000000003',2,'Which food is made by pressing olives?','["Butter","Olive oil","Flour","Vinegar"]',1,'This tree and its fruit appear in a promise of abundance.','Deuteronomy 8:8','Olive oil is extracted from the fruit of olive trees.'),
 ('10000000-0000-4000-8000-000000000003',3,'What is the main ingredient in hummus?','["Rice","Lentils","Chickpeas","Potatoes"]',2,'Daniel asked for a meal of vegetables and water.','Daniel 1:12','Hummus is commonly made from chickpeas, tahini, lemon juice, and garlic.'),
 ('10000000-0000-4000-8000-000000000003',4,'Which spice comes from the bark of a tree?','["Saffron","Pepper","Ginger","Cinnamon"]',3,'This fragrant spice was part of a special anointing oil.','Exodus 30:23','Cinnamon is made from the inner bark of trees in the genus Cinnamomum.')
on conflict(quiz_id,position) do nothing;
