-- =====================================================================
-- SEED DE TESTE — 40 produtos de autopeças (com estoque, aplicações e código de barras)
-- Todos com código começando em "TST-" para apagar fácil depois.
-- Rodar no SQL Editor. Para REMOVER tudo:  DELETE FROM public.produtos WHERE codigo LIKE 'TST-%';
-- =====================================================================

INSERT INTO public.produtos
  (empresa_id, codigo, ref, nome, localizacao, aplicacoes, codigos_auxiliares, preco, custo, estoque, estoque_minimo)
SELECT e.id, v.*
FROM (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1) e,
(VALUES
  ('TST-001','M60','Bateria Moura 60Ah','Corredor A - Prat 01', ARRAY['Gol','Onix','HB20','Palio'], ARRAY['7891000000001'], 459.90, 320.00, 5, 3),
  ('TST-002','M70','Bateria Moura 70Ah','Corredor A - Prat 01', ARRAY['Corolla','Civic','Cruze'], ARRAY['7891000000002'], 589.90, 420.00, 8, 3),
  ('TST-003','H60','Bateria Heliar 60Ah','Corredor A - Prat 02', ARRAY['Gol','Uno','Fox'], ARRAY['7891000000003'], 449.90, 310.00, 0, 3),
  ('TST-004','PF-1234','Pastilha de Freio Diant.','Corredor B - Prat 05', ARRAY['Gol G5','Gol G6','Voyage'], ARRAY['7891000000004'], 89.90, 48.00, 20, 5),
  ('TST-005','PF-2210','Pastilha de Freio Diant.','Corredor B - Prat 05', ARRAY['Onix','Prisma','Cobalt'], ARRAY['7891000000005'], 99.90, 55.00, 14, 5),
  ('TST-006','PF-3300','Pastilha de Freio Diant.','Corredor B - Prat 06', ARRAY['HB20','HB20S','Creta'], ARRAY['7891000000006'], 109.90, 60.00, 2, 5),
  ('TST-007','DF-5501','Disco de Freio Vent.','Corredor B - Prat 07', ARRAY['Gol','Voyage','Saveiro'], ARRAY['7891000000007'], 159.90, 95.00, 9, 4),
  ('TST-008','DF-6602','Disco de Freio Vent.','Corredor B - Prat 07', ARRAY['Onix','Prisma'], ARRAY['7891000000008'], 174.90, 105.00, 6, 4),
  ('TST-009','FO-101','Filtro de Óleo','Corredor C - Prat 02', ARRAY['Gol','Uno','Palio','Strada'], ARRAY['7891000000009'], 24.90, 12.00, 40, 10),
  ('TST-010','FO-202','Filtro de Óleo','Corredor C - Prat 02', ARRAY['Onix','Cobalt','Spin'], ARRAY['7891000000010'], 27.90, 13.50, 35, 10),
  ('TST-011','FA-301','Filtro de Ar','Corredor C - Prat 03', ARRAY['Gol G5','Fox','Polo'], ARRAY['7891000000011'], 39.90, 19.00, 25, 8),
  ('TST-012','FA-402','Filtro de Ar','Corredor C - Prat 03', ARRAY['HB20','Creta','i30'], ARRAY['7891000000012'], 44.90, 22.00, 1, 8),
  ('TST-013','FC-501','Filtro de Combustível','Corredor C - Prat 04', ARRAY['Gol','Uno','Palio'], ARRAY['7891000000013'], 29.90, 14.00, 30, 8),
  ('TST-014','VE-NGK1','Vela de Ignição NGK','Corredor D - Prat 01', ARRAY['Gol 1.0','Uno 1.0','Palio 1.0'], ARRAY['7891000000014'], 18.90, 9.00, 80, 20),
  ('TST-015','VE-NGK2','Vela de Ignição Irídio','Corredor D - Prat 01', ARRAY['Civic','Corolla','City'], ARRAY['7891000000015'], 49.90, 28.00, 50, 15),
  ('TST-016','CD-7001','Correia Dentada','Corredor D - Prat 03', ARRAY['Gol 1.6','Saveiro 1.6'], ARRAY['7891000000016'], 79.90, 42.00, 12, 4),
  ('TST-017','CD-7102','Kit Correia Dentada','Corredor D - Prat 03', ARRAY['Onix 1.4','Cobalt 1.4'], ARRAY['7891000000017'], 229.90, 140.00, 4, 2),
  ('TST-018','AM-9001','Amortecedor Dianteiro','Corredor E - Prat 01', ARRAY['Gol G5','Voyage'], ARRAY['7891000000018'], 199.90, 120.00, 7, 3),
  ('TST-019','AM-9102','Amortecedor Traseiro','Corredor E - Prat 02', ARRAY['Gol G5','Voyage'], ARRAY['7891000000019'], 169.90, 100.00, 0, 3),
  ('TST-020','OL-5W30','Óleo Motor 5W30 Sint. 1L','Corredor F - Prat 01', ARRAY['Universal'], ARRAY['7891000000020'], 39.90, 24.00, 120, 30),
  ('TST-021','OL-15W40','Óleo Motor 15W40 Semi 1L','Corredor F - Prat 01', ARRAY['Universal'], ARRAY['7891000000021'], 29.90, 18.00, 90, 30),
  ('TST-022','LP-H4','Lâmpada Farol H4','Corredor G - Prat 01', ARRAY['Gol','Uno','Palio','Fox'], ARRAY['7891000000022'], 19.90, 8.00, 60, 15),
  ('TST-023','LP-H7','Lâmpada Farol H7','Corredor G - Prat 01', ARRAY['Onix','HB20','Civic'], ARRAY['7891000000023'], 22.90, 9.50, 3, 15),
  ('TST-024','PA-DIANT','Palheta Limpador 22"','Corredor G - Prat 03', ARRAY['Gol','Onix','HB20'], ARRAY['7891000000024'], 34.90, 16.00, 45, 10),
  ('TST-025','PA-TRAS','Palheta Traseira 16"','Corredor G - Prat 03', ARRAY['Gol','Fox'], ARRAY['7891000000025'], 27.90, 12.00, 22, 10),
  ('TST-026','EM-K001','Kit Embreagem','Corredor H - Prat 01', ARRAY['Gol 1.0','Voyage 1.0'], ARRAY['7891000000026'], 389.90, 240.00, 5, 2),
  ('TST-027','BD-3001','Bomba d''Água','Corredor H - Prat 03', ARRAY['Gol 1.6','Saveiro 1.6'], ARRAY['7891000000027'], 129.90, 75.00, 8, 3),
  ('TST-028','RA-4001','Radiador','Corredor I - Prat 01', ARRAY['Gol G5','Voyage'], ARRAY['7891000000028'], 459.90, 290.00, 2, 1),
  ('TST-029','JC-5001','Junta do Cabeçote','Corredor I - Prat 04', ARRAY['Gol 1.0 8V'], ARRAY['7891000000029'], 89.90, 45.00, 6, 2),
  ('TST-030','RO-6001','Rolamento de Roda Diant.','Corredor J - Prat 02', ARRAY['Gol','Uno','Palio'], ARRAY['7891000000030'], 69.90, 38.00, 16, 5),
  ('TST-031','CV-7001','Cabo de Vela (jogo)','Corredor D - Prat 02', ARRAY['Gol 1.0','Uno 1.0'], ARRAY['7891000000031'], 59.90, 32.00, 18, 6),
  ('TST-032','BO-8001','Bobina de Ignição','Corredor D - Prat 04', ARRAY['Onix','Prisma','Cobalt'], ARRAY['7891000000032'], 149.90, 90.00, 0, 3),
  ('TST-033','SE-9001','Sensor de Rotação','Corredor K - Prat 01', ARRAY['Gol G5','Fox'], ARRAY['7891000000033'], 99.90, 55.00, 7, 3),
  ('TST-034','CX-1001','Coxim do Motor','Corredor K - Prat 03', ARRAY['Gol','Voyage'], ARRAY['7891000000034'], 79.90, 42.00, 9, 3),
  ('TST-035','BL-1101','Bieleta Estabilizadora','Corredor L - Prat 01', ARRAY['Onix','Prisma'], ARRAY['7891000000035'], 44.90, 22.00, 24, 6),
  ('TST-036','TD-1201','Terminal de Direção','Corredor L - Prat 02', ARRAY['Gol','Uno','Palio'], ARRAY['7891000000036'], 54.90, 28.00, 13, 4),
  ('TST-037','PV-1301','Pivô de Suspensão','Corredor L - Prat 03', ARRAY['Gol G5','Voyage'], ARRAY['7891000000037'], 64.90, 34.00, 1, 4),
  ('TST-038','MG-1401','Mangueira do Radiador','Corredor I - Prat 02', ARRAY['Gol 1.6'], ARRAY['7891000000038'], 39.90, 18.00, 11, 4),
  ('TST-039','FF-1501','Fluido de Freio DOT4 500ml','Corredor F - Prat 03', ARRAY['Universal'], ARRAY['7891000000039'], 24.90, 11.00, 50, 12),
  ('TST-040','AD-1601','Aditivo Radiador 1L','Corredor F - Prat 03', ARRAY['Universal'], ARRAY['7891000000040'], 19.90, 9.00, 70, 15)
) AS v(codigo, ref, nome, localizacao, aplicacoes, codigos_auxiliares, preco, custo, estoque, estoque_minimo);
