<script lang="ts" setup>
import { reactive } from 'vue'
import GanttView from './view.vue'

const pageInfos: any = reactive({
    // 总范围
    range: ['2023-03', '2027-03'],
    // 显示范围
    periods: ['2025-06', '2026-03'],
    //
    list: [
        {
            id: '1',
            category: '1. Program Strategy',
            color: '#a5d8ff',
            datas: [
                { description: 'Program Kickoff', startDate: '2023-06-01' },
                { description: 'Market Research', startDate: '2023-06-15', endDate: '2023-09-01' },
                { description: 'Budget Approval', startDate: '2023-09-15' },
                { description: 'Concept Freeze', startDate: '2023-12-20' }
            ]
        },
        {
            id: '2',
            category: '2. Product Definition',
            color: '#ffc9c9',
            datas: [
                { description: 'User Experience (UX) Spec', startDate: '2023-10-01', endDate: '2024-01-15' },
                { description: 'Technical Requirements', startDate: '2023-11-01', endDate: '2024-02-01' },
                { description: 'Target Setting (KPIs)', startDate: '2024-01-10' }
            ]
        },
        {
            id: '3',
            category: '3. Design Studio',
            color: '#b2f2bb',
            datas: [
                { description: 'Sketching Phase', startDate: '2023-08-01', endDate: '2023-11-30' },
                { description: '3D Modeling (CAS)', startDate: '2023-12-01', endDate: '2024-03-01' },
                { description: 'Clay Modeling', startDate: '2024-02-15', endDate: '2024-05-15' },
                { description: 'Design Freeze (Theme)', startDate: '2024-05-20' }
            ]
        },
        {
            id: '4',
            category: '4. Interior Design',
            color: '#e6fcf5',
            datas: [
                { description: 'Ergonomics Study', startDate: '2024-01-01', endDate: '2024-03-01' },
                { description: 'Material Selection (CMF)', startDate: '2024-03-05', endDate: '2024-06-01' },
                { description: 'Seat Design', startDate: '2024-04-01', endDate: '2024-08-01' }
            ]
        },
        {
            id: '5',
            category: '5. Body Engineering (BIW)',
            color: '#fcc2d7',
            datas: [
                { description: 'Structure Simulation', startDate: '2024-02-01', endDate: '2024-05-01' },
                { description: 'Tooling Design', startDate: '2024-05-15', endDate: '2024-11-15' },
                { description: 'Crash Safety Analysis', startDate: '2024-06-01', endDate: '2024-08-01' },
                { description: 'Lightweight Optimization', startDate: '2024-07-01', endDate: '2024-09-30' }
            ]
        },
        {
            id: '6',
            category: '6. Chassis & Suspension',
            color: '#d0bfff',
            datas: [
                { description: 'Suspension Tuning', startDate: '2024-06-01', endDate: '2024-12-01' },
                { description: 'Braking System', startDate: '2024-05-01', endDate: '2024-09-01' },
                { description: 'Steering Calibration', startDate: '2024-10-01', endDate: '2025-02-01' }
            ]
        },
        {
            id: '7',
            category: '7. Powertrain (EV)',
            color: '#ffec99',
            datas: [
                { description: 'Battery Cell Selection', startDate: '2023-11-01', endDate: '2024-02-01' },
                { description: 'Pack Thermal Testing', startDate: '2024-03-01', endDate: '2024-07-01' },
                { description: 'Motor Inverter Integ.', startDate: '2024-05-01', endDate: '2024-10-01' },
                { description: 'High Voltage Freeze', startDate: '2024-09-15' }
            ]
        },
        {
            id: '8',
            category: '8. E/E Architecture',
            color: '#ced4da',
            datas: [
                { description: 'Network Topology', startDate: '2023-12-01', endDate: '2024-03-01' },
                { description: 'Wiring Harness Layout', startDate: '2024-04-01', endDate: '2024-08-01' },
                { description: 'ECU Sourcing', startDate: '2024-02-15' }
            ]
        },
        {
            id: '9',
            category: '9. Software Dev',
            color: '#99e9f2',
            datas: [
                { description: 'OS Kernel Porting', startDate: '2024-01-01', endDate: '2024-04-01' },
                { description: 'Middleware Dev', startDate: '2024-02-01', endDate: '2024-06-01' },
                { description: 'OTA Framework', startDate: '2024-03-01', endDate: '2024-08-01' },
                { description: 'Cybersecurity Audit', startDate: '2024-07-01', endDate: '2024-09-01' }
            ]
        },
        {
            id: '10',
            category: '10. Infotainment (IVI)',
            color: '#ffd8a8',
            datas: [
                { description: 'UI/UX Design Phase 1', startDate: '2024-03-01', endDate: '2024-06-01' },
                { description: 'Navi Integration', startDate: '2024-06-15', endDate: '2024-10-15' },
                { description: 'Voice Assistant', startDate: '2024-08-01', endDate: '2024-12-01' },
                { description: 'Beta Release', startDate: '2024-12-20' }
            ]
        },
        {
            id: '11',
            category: '11. ADAS / Autonomous',
            color: '#c0eb75',
            datas: [
                { description: 'Sensor Fusion Algo', startDate: '2024-04-01', endDate: '2024-10-01' },
                { description: 'Highway Pilot Test', startDate: '2024-09-01', endDate: '2025-03-01' },
                { description: 'L2+ Certification', startDate: '2025-04-15' }
            ]
        },
        {
            id: '12',
            category: '12. Prototyping',
            color: '#dee2e6',
            datas: [
                { description: 'Mule Builds (Chassis)', startDate: '2024-01-15', endDate: '2024-03-15' },
                { description: 'VP Builds (Verification)', startDate: '2024-06-01', endDate: '2024-08-01' },
                { description: 'TT Builds (Tooling)', startDate: '2024-11-01', endDate: '2025-01-01' },
                { description: 'PP Builds (Pilot)', startDate: '2025-04-01', endDate: '2025-06-01' }
            ]
        },
        {
            id: '13',
            category: '13. Vehicle Testing',
            color: '#bac8ff',
            datas: [
                { description: 'Winter Test (Sweden)', startDate: '2024-12-01', endDate: '2025-03-01' },
                { description: 'Summer Test (Death Valley)', startDate: '2025-06-01', endDate: '2025-09-01' },
                { description: 'Durability (100k km)', startDate: '2024-10-01', endDate: '2025-04-01' }
            ]
        },
        {
            id: '14',
            category: '14. Homologation',
            color: '#ffc078',
            datas: [
                { description: 'EU Certification', startDate: '2025-01-01', endDate: '2025-05-01' },
                { description: 'CN Certification', startDate: '2025-02-01', endDate: '2025-06-01' },
                { description: 'Homologation Complete', startDate: '2025-07-01' }
            ]
        },
        {
            id: '15',
            category: '15. Supply Chain',
            color: '#69db7c',
            datas: [
                { description: 'Long Lead Items', startDate: '2023-10-01', endDate: '2024-02-01' },
                { description: 'Supplier Nomination', startDate: '2024-01-01', endDate: '2024-05-01' },
                { description: 'Parts Readiness Check', startDate: '2025-01-15' }
            ]
        },
        {
            id: '16',
            category: '16. Manufacturing',
            color: '#3bc9db',
            datas: [
                { description: 'Line Assembly Setup', startDate: '2024-08-01', endDate: '2025-02-01' },
                { description: 'Robot Programming', startDate: '2024-11-01', endDate: '2025-03-01' },
                { description: 'Pre-Production Run', startDate: '2025-05-01', endDate: '2025-07-01' }
            ]
        },
        {
            id: '17',
            category: '17. Quality Assurance',
            color: '#f06595',
            datas: [
                { description: 'Gap & Flush Check', startDate: '2025-04-01', endDate: '2025-06-01' },
                { description: 'Water Leak Test', startDate: '2025-05-01', endDate: '2025-07-01' },
                { description: 'Quality Gate 3', startDate: '2025-08-01' }
            ]
        },
        {
            id: '18',
            category: '18. Marketing',
            color: '#748ffc',
            datas: [
                { description: 'Teaser Campaign', startDate: '2025-03-01', endDate: '2025-06-01' },
                { description: 'Global Reveal Event', startDate: '2025-09-15' },
                { description: 'Media Drives', startDate: '2025-10-01', endDate: '2025-11-01' }
            ]
        },
        {
            id: '19',
            category: '19. Sales & Aftersales',
            color: '#ffa94d',
            datas: [
                { description: 'Dealer Training', startDate: '2025-08-01', endDate: '2025-10-01' },
                { description: 'Service Manuals', startDate: '2025-07-01', endDate: '2025-09-01' },
                { description: 'Order Books Open', startDate: '2025-09-20' }
            ]
        },
        {
            id: '20',
            category: '20. SOP & Delivery',
            color: '#63e6be',
            datas: [
                { description: 'SOP (Job #1)', startDate: '2025-11-01' },
                { description: 'Factory Ramp-up', startDate: '2025-11-05', endDate: '2026-02-01' },
                { description: 'First Customer Delivery', startDate: '2025-12-15' },
                { description: 'Mass Delivery', startDate: '2026-03-01', endDate: '2026-12-31' }
            ]
        }
    ]
});
</script>

<template>
    <div class="sections">
        <GanttView mode="month" :page-infos="pageInfos" />
    </div>
</template>

<style lang="scss"></style>