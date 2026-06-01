-- ================================================================
-- SEED DATA — Demo employees and today's forecast
-- Run after 001_schema.sql
-- ================================================================

-- Demo Employees (warehouse_id = 00000000-0000-0000-0000-000000000001)
INSERT INTO employees (id, warehouse_id, employee_code, full_name, primary_role, secondary_role, tertiary_role, skill_level, current_status) VALUES
  ('e0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'OP001', 'Alex Papadopoulos', 'operator', 'sorter', null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'OP002', 'Maria Georgiou', 'operator', 'picker', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'OP003', 'Nikos Stavros', 'operator', null, null, '5', 'working'),
  ('e0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'PK001', 'Sofia Dimitriou', 'picker', 'packer', null, '5', 'working'),
  ('e0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'PK002', 'Kostas Alexiou', 'picker', 'packer', 'sorter', '4', 'working'),
  ('e0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'PK003', 'Elena Nikolaou', 'picker', 'packer', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'PK004', 'Yannis Petrakis', 'picker', 'transporter', null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'PK005', 'Anna Christodoulou', 'picker', null, null, '2', 'break'),
  ('e0000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'PK006', 'Petros Makris', 'picker', 'packer', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'PA001', 'Irene Papadaki', 'packer', 'validator', null, '5', 'working'),
  ('e0000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'PA002', 'Dimitris Koutsoukos', 'packer', null, null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'PA003', 'Christina Lamprou', 'packer', 'validator', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'PA004', 'Giannis Liakos', 'packer', null, null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'PA005', 'Fotini Athanasiou', 'packer', 'picker', null, '3', 'break'),
  ('e0000001-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'PA006', 'Stavros Zografos', 'packer', null, null, '2', 'working'),
  ('e0000001-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'PA007', 'Katerina Fragou', 'packer', 'picker', 'validator', '4', 'working'),
  ('e0000001-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'PA008', 'Andreas Vlachos', 'packer', null, null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'VA001', 'Despina Karagianni', 'validator', 'packer', null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'VA002', 'Thomas Panagiotou', 'validator', null, null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'SO001', 'Manos Papadimitriou', 'sorter', 'packer', null, '5', 'working'),
  ('e0000001-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'SO002', 'Eleni Samaras', 'sorter', 'packer', 'picker', '4', 'working'),
  ('e0000001-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'SO003', 'Vasilis Antonopoulos', 'sorter', 'transporter', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'SO004', 'Ioanna Papadopoulou', 'sorter', null, null, '4', 'working'),
  ('e0000001-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 'TR001', 'Christos Barmpas', 'transporter', 'picker', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', 'TR002', 'Panos Alexopoulos', 'transporter', 'picker', 'packer', '4', 'working'),
  ('e0000001-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', 'TR003', 'Maria Tsoumani', 'transporter', null, null, '2', 'working'),
  ('e0000001-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', 'TR004', 'Aggelos Konstantinos', 'transporter', 'picker', null, '3', 'working'),
  ('e0000001-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', 'TR005', 'Zoe Papageorgiou', 'transporter', 'sorter', null, '4', 'off'),
  ('e0000001-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', 'PK007', 'Nikos Andreou', 'picker', 'packer', null, '3', 'sick'),
  ('e0000001-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'PA009', 'Lena Simonidou', 'packer', 'sorter', null, '4', 'vacation');

-- Productivity rates
INSERT INTO employee_productivity (employee_id, role, units_per_hour) VALUES
  ('e0000001-0000-0000-0000-000000000004', 'picker', 195),
  ('e0000001-0000-0000-0000-000000000004', 'packer', 152),
  ('e0000001-0000-0000-0000-000000000005', 'picker', 162),
  ('e0000001-0000-0000-0000-000000000005', 'packer', 138),
  ('e0000001-0000-0000-0000-000000000006', 'picker', 118),
  ('e0000001-0000-0000-0000-000000000006', 'packer', 105),
  ('e0000001-0000-0000-0000-000000000007', 'picker', 152),
  ('e0000001-0000-0000-0000-000000000009', 'picker', 122),
  ('e0000001-0000-0000-0000-000000000009', 'packer', 108),
  ('e0000001-0000-0000-0000-000000000010', 'packer', 168),
  ('e0000001-0000-0000-0000-000000000011', 'packer', 145),
  ('e0000001-0000-0000-0000-000000000012', 'packer', 112),
  ('e0000001-0000-0000-0000-000000000013', 'packer', 148),
  ('e0000001-0000-0000-0000-000000000016', 'packer', 142),
  ('e0000001-0000-0000-0000-000000000017', 'packer', 118),
  ('e0000001-0000-0000-0000-000000000020', 'sorter', 220),
  ('e0000001-0000-0000-0000-000000000020', 'packer', 155),
  ('e0000001-0000-0000-0000-000000000021', 'sorter', 178),
  ('e0000001-0000-0000-0000-000000000021', 'packer', 142);

-- Today's forecast
INSERT INTO daily_forecasts (warehouse_id, forecast_date, due_date_orders, same_day_orders, intraday_orders, backlog_orders)
VALUES ('00000000-0000-0000-0000-000000000001', CURRENT_DATE, 1240, 342, 89, 156);

-- Today's ops snapshot
INSERT INTO ops_snapshots (warehouse_id, pending_picking, pending_packing, pending_sorting, backlog_orders, remaining_due_date, remaining_same_day, remaining_intraday, notes, is_latest)
VALUES ('00000000-0000-0000-0000-000000000001', 412, 638, 89, 156, 821, 198, 54, 'AutoStore zone B running slow', true);
