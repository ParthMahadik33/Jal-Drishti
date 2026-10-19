import React from 'react';
import { useDashboardStore } from '../../data/dashboardStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OverviewView } from './views/OverviewView';
import { IncidentsView } from './views/IncidentsView';
import { RiskMapView } from './views/RiskMapView';
import { ActionQueueView } from './views/ActionQueueView';
import { MaintenanceView } from './views/MaintenanceView';
import { AnalyticsView } from './views/AnalyticsView';
import { DataLayersView } from './views/DataLayersView';
import { ZonesView } from './views/ZonesView';
import { SettingsView } from './views/SettingsView';
import { RecordActionModal } from './RecordActionModal';
import { NotificationsDrawer } from './NotificationsDrawer';

interface OfficerDashboardProps {
  onNavigateHome: () => void;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ onNavigateHome }) => {
  const {
    state,
    selectedZone,
    selectedIncident,
    selectedEvaluation,
    zoneIncidents,
    zoneMaintenance,
    setView,
    selectZone,
    selectIncident,
    selectQueueItem,
    updateIncidentState,
    recordMaintenanceAction,
    handleRecurrenceReview,
    triggerRecurrenceSimulation,
    runResourceScenario,
    refreshWeather,
    toggleLayer,
    setFilterStatus,
    setSearchQuery,
    setNotificationsOpen,
    setActionModalOpen,
    markAlertsRead,
    resetDemoState,
    setDataMode,
    retryConnection,
  } = useDashboardStore();

  const unreadAlertsCount = state.alerts.filter((a) => !a.read).length;

  return (
    <div className="flex w-full min-h-screen bg-[#F5F8FC] text-[#10243B] font-sans antialiased overflow-x-hidden">
      {/* 1. Left Fixed Navigation Rail */}
      <Sidebar
        currentView={state.currentView}
        onSelectView={setView}
        onNavigateHome={onNavigateHome}
        dataMode={state.dataMode}
        onToggleDataMode={() => setDataMode(state.dataMode === 'api' ? 'demo' : 'api')}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header
          currentView={state.currentView}
          unreadAlertsCount={unreadAlertsCount}
          dataMode={state.dataMode}
          apiConnected={state.apiConnected}
          apiError={state.apiError}
          isLoading={state.isLoading}
          onToggleNotifications={() => setNotificationsOpen(true)}
          onOpenRecordAction={() => setActionModalOpen(true)}
          onTriggerRecurrenceSim={() => triggerRecurrenceSimulation(state.selectedZoneId)}
          onRetryConnection={retryConnection}
          onToggleDataMode={() => setDataMode(state.dataMode === 'api' ? 'demo' : 'api')}
        />

        {/* View Content (Scrollable) */}
        <main className="flex-1 p-6">
          {state.currentView === 'overview' && (
            <OverviewView
              zones={state.zones}
              incidents={state.incidents}
              maintenance={state.maintenance}
              queue={state.queue}
              rainfall={state.rainfall}
              weatherSnapshot={state.weatherSnapshot}
              isWeatherLoading={state.isWeatherLoading}
              isWeatherRefreshing={state.isWeatherRefreshing}
              weatherError={state.weatherError}
              isDemoMode={state.dataMode === 'demo'}
              onRefreshWeather={() => refreshWeather(state.selectedZoneId)}
              selectedZone={selectedZone}
              selectedIncident={selectedIncident}
              selectedEvaluation={selectedEvaluation}
              evaluations={state.evaluations}
              zoneIncidents={zoneIncidents}
              zoneMaintenance={zoneMaintenance}
              selectedZoneId={state.selectedZoneId}
              selectedIncidentId={state.selectedIncidentId}
              onSelectZone={selectZone}
              onSelectIncident={selectIncident}
              onSelectQueueItem={selectQueueItem}
              onUpdateIncidentState={updateIncidentState}
              onOpenRecordAction={() => setActionModalOpen(true)}
              onRecurrenceDecision={handleRecurrenceReview}
              onOpenHistoricalReplay={() => setView('analytics')}
              onNavigateToRiskMap={() => setView('map')}
              layerState={state.layerState}
              onToggleLayer={toggleLayer}
              filterStatus={state.filterStatus}
              onFilterChange={setFilterStatus}
              searchQuery={state.searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {state.currentView === 'incidents' && (
            <IncidentsView
              incidents={state.incidents}
              onUpdateIncidentState={updateIncidentState}
              onSelectZone={(zoneId) => {
                selectZone(zoneId);
                setView('overview');
              }}
            />
          )}

          {state.currentView === 'map' && (
            <RiskMapView
              zones={state.zones}
              incidents={state.incidents}
              selectedZoneId={state.selectedZoneId}
              selectedIncidentId={state.selectedIncidentId}
              onSelectZone={selectZone}
              onSelectIncident={selectIncident}
              layerState={state.layerState}
              onToggleLayer={toggleLayer}
            />
          )}

          {state.currentView === 'queue' && (
            <ActionQueueView
              queue={state.queue}
              zones={state.zones}
              evaluations={state.evaluations}
              scenarioResults={state.scenarioResults}
              isScenarioLoading={state.isScenarioLoading}
              onRunScenario={runResourceScenario}
              selectedZoneId={state.selectedZoneId}
              onSelectQueueItem={(hotspotId) => {
                selectQueueItem(hotspotId);
                setView('overview');
              }}
              onSelectZone={(zoneId) => {
                selectZone(zoneId);
                setView('overview');
              }}
              filterStatus={state.filterStatus}
              onFilterChange={setFilterStatus}
              searchQuery={state.searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {state.currentView === 'maintenance' && (
            <MaintenanceView
              maintenance={state.maintenance}
              zones={state.zones}
              onOpenRecordAction={() => setActionModalOpen(true)}
              onSelectZone={(zoneId) => {
                selectZone(zoneId);
                setView('overview');
              }}
            />
          )}

          {state.currentView === 'analytics' && (
            <AnalyticsView onResetDemo={resetDemoState} />
          )}

          {state.currentView === 'data_layers' && <DataLayersView />}

          {state.currentView === 'zones' && (
            <ZonesView
              zones={state.zones}
              selectedZoneId={state.selectedZoneId}
              onSelectZone={selectZone}
              onNavigateToOverview={() => setView('overview')}
            />
          )}

          {state.currentView === 'settings' && (
            <SettingsView
              onResetDemo={resetDemoState}
              onTriggerRecurrenceSim={() => triggerRecurrenceSimulation(state.selectedZoneId)}
            />
          )}
        </main>
      </div>

      {/* Record Action Modal */}
      <RecordActionModal
        isOpen={state.isActionModalOpen}
        onClose={() => setActionModalOpen(false)}
        zones={state.zones}
        defaultZoneId={state.selectedZoneId}
        isSaving={state.isSaving}
        onSaveAction={recordMaintenanceAction}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={state.isNotificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        alerts={state.alerts}
        onSelectZone={(zoneId) => {
          selectZone(zoneId);
          setView('overview');
        }}
        onMarkAllRead={markAlertsRead}
      />
    </div>
  );
};
