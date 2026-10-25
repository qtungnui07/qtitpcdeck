/*
 * Typed endpoint wrappers.
 *
 * The Angular ApiService has ~250 of these, all one-liners over the same HTTP
 * helper. They are added here as pages need them rather than all at once, so
 * this file grows with the migration instead of arriving as a 2000-line port.
 *
 * Paths and verbs are copied verbatim from api.service.ts.
 */

import type {
  AuthStatusResponse,
  BindCatalogVariableRequest,
  BindCatalogVariableResponse,
  ChangePasswordRequest,
  ChangeUsernameRequest,
  CompanionLicenseStatus,
  ConnectAdbDeviceRequest,
  ConnectAdbDeviceResponse,
  ConnectNativeUsbDeviceRequest,
  ConnectNativeUsbDeviceResponse,
  CreateAutomationRequest,
  CreateAutomationResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  CreateIconPackRequest,
  CreateIconPackResponse,
  CreateProfileRequest,
  CreateProfileResponse,
  CreateScriptRequest,
  CreateScriptResponse,
  CreateVariableRequest,
  CreateVariableResponse,
  CreateWidgetRequest,
  CreateWidgetFromApplicationRequest,
  CreateWidgetResponse,
  CreateWidgetsRequest,
  CreateWidgetsResponse,
  DeleteAutomationResponse,
  CloneSecretResponse,
  DeleteConfigEntryResponse,
  DeleteFolderRequest,
  DeleteFolderResponse,
  DeleteIconPackResponse,
  DeleteIconResponse,
  DeleteIconsRequest,
  DeleteIconsResponse,
  DeleteProfileRequest,
  DeleteProfileResponse,
  DeleteScriptResponse,
  DeleteUserFontResponse,
  DeleteVariableResponse,
  DeleteWidgetRequest,
  DeleteWidgetResponse,
  DeleteWidgetsRequest,
  DeleteWidgetsResponse,
  DeviceLoginInfo,
  DiscoverCatalogVariablesRequest,
  DiscoverCatalogVariablesResponse,
  DownloadAdbPlatformToolsResponse,
  DuplicateAutomationResponse,
  DuplicateFolderResponse,
  DuplicateScriptResponse,
  EvaluateConditionRequest,
  EvaluateConditionResponse,
  EvaluateExpressionRequest,
  EvaluateExpressionResponse,
  ExecuteActionButtonTriggerRequest,
  ExecuteActionButtonTriggerResponse,
  ExecuteActionRequest,
  ExecuteActionResponse,
  ForgetNativeUsbDeviceRequest,
  ForgetNativeUsbDeviceResponse,
  GetAdbSettingsResponse,
  ImportWidgetsResponse,
  InspectArchiveResponse,
  GetConnectionInfoResponse,
  GetAppearanceSettingsResponse,
  GetAutostartSettingsResponse,
  GetAutomationsResponse,
  GetConfigEntriesResponse,
  GetDataDirectoryResponse,
  GetDeveloperSettingsResponse,
  GetEventDefinitionsResponse,
  GetExtensionSettingsResponse,
  GetFoldersResponse,
  GetHttpSettingsResponse,
  GetIconPacksResponse,
  GetIconsResponse,
  GetIntegrationCapabilitiesResponse,
  GetIntegrationIssuesResponse,
  GetIntegrationsResponse,
  GetLocalizationResponse,
  GetLockScreenSettingsResponse,
  GetLoggingSettingsResponse,
  GetLogsRequest,
  GetLogsResponse,
  GetLogSourcesResponse,
  GetNativeUsbSettingsResponse,
  GetNetworkSettingsResponse,
  GetPendingAnnouncementResponse,
  PairingCodeResponse,
  GetPluginCompatibilityResponse,
  GetProfilesResponse,
  GetScriptsResponse,
  GetActionsResponse,
  GetScriptUsagesResponse,
  GetStoreCatalogResponse,
  GetStoreCategoriesResponse,
  GetStoreExtensionResponse,
  GetStoreOperationsResponse,
  GetStoreRepositoryIssuesResponse,
  GetStoreSimilarResponse,
  GetStoreStatusResponse,
  GetStoreTestsResponse,
  GetStoreUpdatesResponse,
  GetUserFontsResponse,
  GetUserNotificationsResponse,
  GetVariableCatalogProvidersResponse,
  GetVariablesResponse,
  ImportIconPacksResponse,
  ImportIconsFromPathRequest,
  ImportIconsResponse,
  ImportUserFontsResponse,
  InstallStoreExtensionRequest,
  InstallStoreTestBuildRequest,
  LoginRequest,
  MarkAnnouncementSeenRequest,
  MoveFolderRequest,
  MoveFolderResponse,
  MoveProfileRequest,
  MoveProfileResponse,
  OpenDataDirectoryResponse,
  RedeemCompanionPromoCodeResponse,
  RedeemDeviceEnrollmentRequest,
  RefreshStoreRegistryResponse,
  RenameCatalogVariableRequest,
  RenameCatalogVariableResponse,
  RenameConfigEntryResponse,
  RenderTemplateRequest,
  RenderTemplateResponse,
  ResetPasswordRequest,
  ResolveCatalogVariableRequest,
  ResolveCatalogVariableResponse,
  ResolveIntegrationIssueResponse,
  ResolveStoreLinkResponse,
  RestartAdbServerResponse,
  RestartApplicationResponse,
  RunActionFlowRequest,
  RunActionFlowResponse,
  RunScriptRequest,
  RunScriptResponse,
  SanitizeVariableNameRequest,
  SanitizeVariableNameResponse,
  SetIntegrationEnabledRequest,
  SetIntegrationEnabledResponse,
  SetWidgetPinnedRequest,
  SetWidgetPinnedResponse,
  SetWidgetsPinnedRequest,
  SetWidgetsPinnedResponse,
  SetVariableSharedRequest,
  SetVariableSharedResponse,
  SetVariableValueRequest,
  SetVariableValueResponse,
  SetupRequest,
  WidgetTypeDto,
  StoreCatalogSection,
  StoreExtensionKind,
  StoreOperationActionResponse,
  TokenResponse,
  TriggerEventRequest,
  TriggerEventResponse,
  UnbindCatalogVariableResponse,
  UninstallStoreExtensionRequest,
  UninstallStoreExtensionResponse,
  UpdateAdbSettingsRequest,
  UpdateAdbSettingsResponse,
  UpdateAppearanceSettingsRequest,
  UpdateAppearanceSettingsResponse,
  UpdateAutostartSettingsRequest,
  UpdateAutostartSettingsResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
  UpdateDeveloperSettingsRequest,
  UpdateDeveloperSettingsResponse,
  UpdateExtensionSettingsRequest,
  UpdateExtensionSettingsResponse,
  UpdateFolderRequest,
  UpdateFolderResponse,
  UpdateHttpSettingsRequest,
  UpdateHttpSettingsResponse,
  UpdateIconPackRequest,
  UpdateIconPackResponse,
  UpdateIconRequest,
  UpdateIconResponse,
  UpdateLocalizationSettingsRequest,
  UpdateLocalizationSettingsResponse,
  UpdateLockScreenSettingsRequest,
  UpdateLockScreenSettingsResponse,
  UpdateLoggingSettingsRequest,
  UpdateLoggingSettingsResponse,
  UpdateNativeUsbSettingsRequest,
  UpdateNativeUsbSettingsResponse,
  UpdateNetworkSettingsRequest,
  UpdateNetworkSettingsResponse,
  UpdateNetworkTlsCertificateRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateScriptRequest,
  UpdateScriptResponse,
  UpdateVariableRequest,
  UpdateVariableResponse,
  UpdateWidgetPositionsRequest,
  UpdateWidgetPositionsResponse,
  UpdateWidgetRequest,
  UpdateWidgetResponse,
} from '@macro-deck/runtime';
import { api, del, get, getBlob, invokeResult, patch, post, postForm, put } from './api.svelte';

/* Auth. Every one of these skips the 401 retry: a login that fails must not
 * trigger a refresh, and a refresh that fails must not trigger itself. */
export const authEndpoints = {
  status: (): Promise<AuthStatusResponse> => get('/api/auth/status'),
  setup: (request: SetupRequest): Promise<void> => post('/api/auth/setup', request),
  login: (request: LoginRequest): Promise<TokenResponse> => post('/api/auth/login', request),
  refresh: (): Promise<TokenResponse> => post('/api/auth/refresh'),
  logout: (): Promise<void> => post('/api/auth/logout'),
  changePassword: (request: ChangePasswordRequest): Promise<void> =>
    post('/api/auth/change-password', request),
  changeUsername: (request: ChangeUsernameRequest): Promise<void> =>
    post('/api/auth/change-username', request),
  resetPassword: (request: ResetPasswordRequest): Promise<void> =>
    post('/api/auth/reset-password', request),
  redeemDeviceEnrollment: (request: RedeemDeviceEnrollmentRequest): Promise<TokenResponse> =>
    post('/api/auth/device-enrollment/redeem', request),
};

export const notificationEndpoints = {
  list: (): Promise<GetUserNotificationsResponse> => get('/api/notifications'),
  dismiss: (id: string): Promise<void> =>
    del(`/api/notifications/${encodeURIComponent(id)}`),
  dismissAll: (): Promise<void> => del('/api/notifications'),
  markRead: (id: string): Promise<{ success: boolean }> =>
    put(`/api/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: (): Promise<{ success: boolean }> => put('/api/notifications/read'),
};

export const localizationEndpoints = {
  catalog: (): Promise<GetLocalizationResponse> => get('/api/localization'),
  updateSettings: (
    request: UpdateLocalizationSettingsRequest,
  ): Promise<UpdateLocalizationSettingsResponse> => put('/api/settings/localization', request),
};

export const announcementEndpoints = {
  pending: (): Promise<GetPendingAnnouncementResponse> => get('/api/announcements/pending'),
  markSeen: (request: MarkAnnouncementSeenRequest): Promise<void> =>
    post('/api/announcements/seen', request),
};

export const variableEndpoints = {
  list: (): Promise<GetVariablesResponse> => get('/api/variables'),
  create: (request: CreateVariableRequest): Promise<CreateVariableResponse> =>
    post('/api/variables', request),
  update: (request: UpdateVariableRequest): Promise<UpdateVariableResponse> =>
    put('/api/variables', request),
  remove: (id: string): Promise<DeleteVariableResponse> =>
    del(`/api/variables/${encodeURIComponent(id)}`),
  setValue: (request: SetVariableValueRequest): Promise<SetVariableValueResponse> =>
    patch(`/api/variables/${encodeURIComponent(request.id)}/value`, request),
  setShared: (request: SetVariableSharedRequest): Promise<SetVariableSharedResponse> =>
    patch(`/api/variables/${encodeURIComponent(request.id)}/shared`, request),
  sanitizeName: (request: SanitizeVariableNameRequest): Promise<SanitizeVariableNameResponse> =>
    post('/api/variables/sanitize-name', request),
};

/*
 * The catalog is split between HTTP and the socket: discovery and resolution are host calls that
 * can be slow or unavailable, so they go over the socket and may resolve to null. Binding is a
 * plain write and goes over HTTP.
 */
export const variableCatalogEndpoints = {
  providers: (): Promise<GetVariableCatalogProvidersResponse | null> =>
    invokeResult<GetVariableCatalogProvidersResponse>('GetVariableCatalogProviders'),
  discover: (
    request: DiscoverCatalogVariablesRequest,
  ): Promise<DiscoverCatalogVariablesResponse | null> =>
    invokeResult<DiscoverCatalogVariablesResponse>('DiscoverCatalogVariables', request),
  resolve: (
    request: ResolveCatalogVariableRequest,
  ): Promise<ResolveCatalogVariableResponse | null> =>
    invokeResult<ResolveCatalogVariableResponse>('ResolveCatalogVariable', request),
  bind: (request: BindCatalogVariableRequest): Promise<BindCatalogVariableResponse> =>
    post('/api/variables/catalog/bind', request),
  unbind: (variableId: string): Promise<UnbindCatalogVariableResponse> =>
    del(`/api/variables/catalog/${encodeURIComponent(variableId)}`),
  rename: (request: RenameCatalogVariableRequest): Promise<RenameCatalogVariableResponse> =>
    patch(`/api/variables/catalog/${encodeURIComponent(request.variableId)}/name`, request),
};

export const integrationEndpoints = {
  list: (): Promise<GetIntegrationsResponse> => get('/api/integrations'),
  setEnabled: (request: SetIntegrationEnabledRequest): Promise<SetIntegrationEnabledResponse> =>
    patch(`/api/integrations/${encodeURIComponent(request.id)}/enabled`, {
      enabled: request.enabled,
    }),
  configEntries: (integrationId: string): Promise<GetConfigEntriesResponse> =>
    get(`/api/integrations/${encodeURIComponent(integrationId)}/config-entries`),
  renameConfigEntry: (
    integrationId: string,
    entryId: string,
    title: string,
  ): Promise<RenameConfigEntryResponse> =>
    patch(
      `/api/integrations/${encodeURIComponent(integrationId)}/config-entries/${encodeURIComponent(entryId)}`,
      { title },
    ),
  deleteConfigEntry: (
    integrationId: string,
    entryId: string,
    confirmed = false,
  ): Promise<DeleteConfigEntryResponse> =>
    del(
      `/api/integrations/${encodeURIComponent(integrationId)}/config-entries/${encodeURIComponent(entryId)}?confirmed=${confirmed}`,
    ),
  issues: (integrationId: string): Promise<GetIntegrationIssuesResponse> =>
    get(`/api/integrations/${encodeURIComponent(integrationId)}/issues`),
  capabilities: (integrationId: string): Promise<GetIntegrationCapabilitiesResponse> =>
    get(`/api/integrations/${encodeURIComponent(integrationId)}/capabilities`),
  resolveIssue: (
    integrationId: string,
    issueId: string,
  ): Promise<ResolveIntegrationIssueResponse> =>
    post(
      `/api/integrations/${encodeURIComponent(integrationId)}/issues/${encodeURIComponent(issueId)}/resolve`,
    ),
  iconUrl: (integrationId: string, version?: string | null): string => {
    const url = `/api/integrations/${encodeURIComponent(integrationId)}/icon`;
    return version ? `${url}?v=${encodeURIComponent(version)}` : url;
  },
};

export const iconPackEndpoints = {
  list: (): Promise<GetIconPacksResponse> => get('/api/icon-packs'),
  icons: (packId: string): Promise<GetIconsResponse> =>
    get(`/api/icons?packId=${encodeURIComponent(packId)}`),
  create: (request: CreateIconPackRequest): Promise<CreateIconPackResponse> =>
    post('/api/icon-packs', request),
  update: (packId: string, request: UpdateIconPackRequest): Promise<UpdateIconPackResponse> =>
    put(`/api/icon-packs/${encodeURIComponent(packId)}`, request),
  remove: (packId: string): Promise<DeleteIconPackResponse> =>
    del(`/api/icon-packs/${encodeURIComponent(packId)}`),
  renameIcon: (iconId: string, request: UpdateIconRequest): Promise<UpdateIconResponse> =>
    patch(`/api/icons/${encodeURIComponent(iconId)}`, request),
  deleteIcon: (iconId: string): Promise<DeleteIconResponse> =>
    del(`/api/icons/${encodeURIComponent(iconId)}`),
  deleteIcons: (request: DeleteIconsRequest): Promise<DeleteIconsResponse> =>
    post('/api/icons/delete', request),
  uploadIcons: (packId: string, form: FormData): Promise<ImportIconsResponse> =>
    postForm(`/api/icon-packs/${encodeURIComponent(packId)}/import`, form),
  importFromPath: (packId: string, request: ImportIconsFromPathRequest): Promise<ImportIconsResponse> =>
    post(`/api/icon-packs/${encodeURIComponent(packId)}/import-path`, request),
  importIconPacks: (form: FormData): Promise<ImportIconPacksResponse> =>
    postForm('/api/icon-packs/import', form),
  exportPack: (packId: string): Promise<{ blob: Blob; fileName?: string }> =>
    getBlob(`/api/icon-packs/${encodeURIComponent(packId)}/export`),
  restoreFromPath: (path: string): Promise<ImportIconPacksResponse> =>
    post('/api/icon-packs/restore-from-path', { path }),
  iconImageUrl: (iconId: string, version?: string | null, size?: number): string => {
    const query = [
      ...(size ? [`size=${size}`] : []),
      `v=${encodeURIComponent(version ?? '')}`,
    ].join('&');
    return `${api.baseUrl}/api/icons/${encodeURIComponent(iconId)}/image?${query}`;
  },
};

export const fontEndpoints = {
  userFonts: (): Promise<GetUserFontsResponse> => get('/api/fonts'),
  importFonts: (form: FormData): Promise<ImportUserFontsResponse> => postForm('/api/fonts/import', form),
  deleteFont: (fontId: string): Promise<DeleteUserFontResponse> =>
    del(`/api/fonts/${encodeURIComponent(fontId)}`),
  fontFileUrl: (faceId: string): string =>
    `${api.baseUrl}/api/system/fonts/${encodeURIComponent(faceId)}/file`,
};

export const pluginCompatibilityEndpoints = {
  get: (): Promise<GetPluginCompatibilityResponse> => get('/api/plugin-compatibility'),
};

export const profileEndpoints = {
  list: (): Promise<GetProfilesResponse> => get('/api/profiles'),
  create: (request: CreateProfileRequest): Promise<CreateProfileResponse> =>
    post('/api/profiles', request),
  update: (request: UpdateProfileRequest): Promise<UpdateProfileResponse> =>
    put('/api/profiles', request),
  delete: (requestOrId: DeleteProfileRequest | string): Promise<DeleteProfileResponse> => {
    const id = typeof requestOrId === 'string' ? requestOrId : requestOrId.id;
    return del(`/api/profiles/${encodeURIComponent(id)}`);
  },
  move: (
    idOrRequest: MoveProfileRequest | string,
    maybeRequest?: { targetId: string; position: 'before' | 'after' },
  ): Promise<MoveProfileResponse> => {
    if (typeof idOrRequest === 'string') {
      return post(`/api/profiles/${encodeURIComponent(idOrRequest)}/move`, maybeRequest);
    }
    return post(`/api/profiles/${encodeURIComponent(idOrRequest.id)}/move`, {
      targetId: idOrRequest.targetId,
      position: idOrRequest.position,
    });
  },
  duplicate: (id: string, name: string): Promise<CreateProfileResponse> =>
    post(`/api/profiles/${encodeURIComponent(id)}/duplicate`, { name }),
};

export const folderEndpoints = {
  list: (profileId?: string): Promise<GetFoldersResponse> => {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    return get(`/api/folders${query}`);
  },
  create: (request: CreateFolderRequest): Promise<CreateFolderResponse> =>
    post('/api/folders', request),
  update: (request: UpdateFolderRequest): Promise<UpdateFolderResponse> =>
    put('/api/folders', request),
  delete: (requestOrId: DeleteFolderRequest | string): Promise<DeleteFolderResponse> => {
    const id = typeof requestOrId === 'string' ? requestOrId : requestOrId.id;
    return del(`/api/folders/${encodeURIComponent(id)}`);
  },
  duplicate: (id: string): Promise<DuplicateFolderResponse> =>
    post(`/api/folders/${encodeURIComponent(id)}/duplicate`),
  move: (
    idOrRequest: MoveFolderRequest | string,
    maybeRequest?: { targetId: string; position: 'before' | 'after' | 'inside' },
  ): Promise<MoveFolderResponse> => {
    if (typeof idOrRequest === 'string') {
      return post(`/api/folders/${encodeURIComponent(idOrRequest)}/move`, maybeRequest);
    }
    return post(`/api/folders/${encodeURIComponent(idOrRequest.id)}/move`, {
      targetId: idOrRequest.targetId,
      position: idOrRequest.position,
    });
  },
};

export const widgetEndpoints = {
  create: (request: CreateWidgetRequest): Promise<CreateWidgetResponse> =>
    post('/api/widgets', request),
  createBatch: (request: CreateWidgetsRequest): Promise<CreateWidgetsResponse> =>
    post('/api/widgets/batch', request),
  update: (request: UpdateWidgetRequest): Promise<UpdateWidgetResponse> =>
    put('/api/widgets', request),
  delete: (requestOrId: DeleteWidgetRequest | string): Promise<DeleteWidgetResponse> => {
    if (typeof requestOrId === 'string') {
      return del(`/api/widgets/${encodeURIComponent(requestOrId)}`);
    }
    return del(`/api/widgets/${encodeURIComponent(requestOrId.id)}?folderId=${encodeURIComponent(requestOrId.folderId)}`);
  },
  deleteBatch: (request: DeleteWidgetsRequest): Promise<DeleteWidgetsResponse> =>
    post('/api/widgets/batch/delete', request),
  createFromApplication: (request: CreateWidgetFromApplicationRequest): Promise<CreateWidgetResponse> =>
    post(`/api/widgets/from-application`, request),
  updatePositions: (request: UpdateWidgetPositionsRequest): Promise<UpdateWidgetPositionsResponse> =>
    put('/api/widgets/positions', request),
  setPinned: (request: SetWidgetPinnedRequest): Promise<SetWidgetPinnedResponse> =>
    put('/api/widgets/pinned', request),
  setWidgetsPinned: (request: SetWidgetsPinnedRequest): Promise<SetWidgetsPinnedResponse> =>
    put('/api/widgets/pinned/batch', request),
  executeTrigger: (request: ExecuteActionButtonTriggerRequest): Promise<ExecuteActionButtonTriggerResponse> =>
    post('/api/actions/execute', request),
};

/**
 * The action catalogue - the definitions every integration exposes, which the
 * action builder turns into droppable blocks. The developer page keeps its own
 * group (`developerEndpoints`) for running actions; this one serves the action
 * catalogue store and the action builder.
 */
export const actionEndpoints = {
  list: (): Promise<GetActionsResponse> => get('/api/actions'),
  runFlow: (request: RunActionFlowRequest): Promise<RunActionFlowResponse> =>
    post('/api/actions/run-flow', request),
  cloneSecret: (id: string): Promise<CloneSecretResponse> =>
    post(`/api/secrets/${encodeURIComponent(id)}/clone`, {}),
};

/**
 * Archive inspection and widget import - what a dropped *.macrodeckwidget
 * archive goes through.
 */
export const archiveEndpoints = {
  inspectPath: (request: { path: string }): Promise<InspectArchiveResponse> =>
    post('/api/portable/inspect-path', request),
  importWidgetsFromPath: (request: {
    folderId: string;
    anchorX: number;
    anchorY: number;
    path: string;
    password?: string;
  }): Promise<ImportWidgetsResponse> => post('/api/widgets/import-path', request),
};

/**
 * The event catalogue - the definitions the event trigger editor offers.
 */
export const eventEndpoints = {
  list: (): Promise<GetEventDefinitionsResponse> => get('/api/events'),
};

/**
 * Connection info and pairing - what the shell's connection panel shows so a
 * phone or browser can pair with this host.
 */
export const connectionEndpoints = {
  info: (): Promise<GetConnectionInfoResponse> => get('/api/system/connection-info'),
  getPairingCode: (): Promise<PairingCodeResponse> => get('/api/auth/pairing-code'),
  rotatePairingCode: (): Promise<PairingCodeResponse> => post('/api/auth/pairing-code', {}),
};

/**
 * The widget type catalogue - a separate resource from widget instances, with
 * its own endpoint group so the boundary rules can keep their readers apart.
 */
export const widgetTypeEndpoints = {
  /**
   * The REST response wraps the catalogue in a result envelope the runtime's
   * `GetWidgetTypesResponse` (written for the notification, which carries the
   * list alone) does not have, so the wire shape is restated here.
   */
  list: (): Promise<{ success: boolean; error?: { code?: string; message?: unknown }; types: WidgetTypeDto[] }> =>
    get('/api/widgets/types'),
};

export interface StoreCatalogOptions {
  kinds?: StoreExtensionKind[];
  search?: string;
  section?: StoreCatalogSection;
  category?: string;
  skip?: number;
  take?: number;
  installed?: boolean;
  supportedOnly?: boolean;
  publisher?: string;
  tag?: string;
}

export const storeCatalogEndpoints = {
  list: (options?: StoreCatalogOptions): Promise<GetStoreCatalogResponse> => {
    const query = new URLSearchParams();
    for (const kind of options?.kinds ?? []) {
      query.append('kinds', kind);
    }
    if (options?.search) {
      query.set('search', options.search);
    }
    if (options?.section) {
      query.set('section', options.section);
    }
    if (options?.category) {
      query.set('category', options.category);
    }
    if (options?.skip !== undefined) {
      query.set('skip', String(options.skip));
    }
    if (options?.take !== undefined) {
      query.set('take', String(options.take));
    }
    if (options?.installed) {
      query.set('installed', 'true');
    }
    if (options?.supportedOnly) {
      query.set('supportedOnly', 'true');
    }
    if (options?.publisher) {
      query.set('publisher', options.publisher);
    }
    if (options?.tag) {
      query.set('tag', options.tag);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return get(`/api/store/catalog${suffix}`);
  },
  categories: (kinds?: StoreExtensionKind[], supportedOnly?: boolean): Promise<GetStoreCategoriesResponse> => {
    const query = new URLSearchParams();
    for (const kind of kinds ?? []) {
      query.append('kinds', kind);
    }
    if (supportedOnly) {
      query.set('supportedOnly', 'true');
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return get(`/api/store/categories${suffix}`);
  },
  status: (): Promise<GetStoreStatusResponse> => get('/api/store/status'),
  refreshRegistry: (): Promise<RefreshStoreRegistryResponse> => post('/api/store/registry/refresh'),
};

export const storeOperationEndpoints = {
  list: (): Promise<GetStoreOperationsResponse> => get('/api/store/operations'),
  install: (request: InstallStoreExtensionRequest): Promise<StoreOperationActionResponse> =>
    post('/api/store/install', request),
  retry: (operationId: string): Promise<StoreOperationActionResponse> =>
    post(`/api/store/operations/${encodeURIComponent(operationId)}/retry`),
  cancel: (operationId: string): Promise<StoreOperationActionResponse> =>
    post(`/api/store/operations/${encodeURIComponent(operationId)}/cancel`),
  dismiss: (operationId: string): Promise<StoreOperationActionResponse> =>
    del(`/api/store/operations/${encodeURIComponent(operationId)}`),
  uninstall: (request: UninstallStoreExtensionRequest): Promise<UninstallStoreExtensionResponse> =>
    post('/api/store/uninstall', request),
};

export const storeUpdatesEndpoints = {
  list: (): Promise<GetStoreUpdatesResponse> => get('/api/store/updates'),
  check: (): Promise<GetStoreUpdatesResponse> => post('/api/store/updates/check'),
  installAll: (): Promise<GetStoreOperationsResponse> => post('/api/store/updates/install'),
};

export const storeDetailEndpoints = {
  get: (kind: StoreExtensionKind, packageId: string): Promise<GetStoreExtensionResponse> =>
    get(`/api/store/catalog/${encodeURIComponent(kind)}/${encodeURIComponent(packageId)}`),
  issues: (kind: StoreExtensionKind, packageId: string): Promise<GetStoreRepositoryIssuesResponse> =>
    get(`/api/store/catalog/${encodeURIComponent(kind)}/${encodeURIComponent(packageId)}/issues`),
  similar: (kind: StoreExtensionKind, packageId: string, take?: number): Promise<GetStoreSimilarResponse> => {
    const suffix = take !== undefined ? `?take=${take}` : '';
    return get(`/api/store/catalog/${encodeURIComponent(kind)}/${encodeURIComponent(packageId)}/similar${suffix}`);
  },
  resolveLink: (packageId: string): Promise<ResolveStoreLinkResponse> =>
    get(`/api/store/resolve/${encodeURIComponent(packageId)}`),
};

export const storeTestsEndpoints = {
  list: (): Promise<GetStoreTestsResponse> => get('/api/store/tests'),
  install: (request: InstallStoreTestBuildRequest): Promise<StoreOperationActionResponse> =>
    post('/api/store/tests/install', request),
};

export const scriptEndpoints = {
  list: (): Promise<GetScriptsResponse> => get('/api/scripts'),
  usages: (id: string): Promise<GetScriptUsagesResponse> =>
    get(`/api/scripts/${encodeURIComponent(id)}/usages`),
  create: (request: CreateScriptRequest): Promise<CreateScriptResponse> =>
    post('/api/scripts', request),
  update: (request: UpdateScriptRequest): Promise<UpdateScriptResponse> =>
    put(`/api/scripts/${encodeURIComponent(request.id)}`, request),
  duplicate: (id: string): Promise<DuplicateScriptResponse> =>
    post(`/api/scripts/${encodeURIComponent(id)}/duplicate`, {}),
  delete: (id: string): Promise<DeleteScriptResponse> =>
    del(`/api/scripts/${encodeURIComponent(id)}`),
  run: (request: RunScriptRequest): Promise<RunScriptResponse> =>
    post(`/api/scripts/${encodeURIComponent(request.id)}/run`, request),
};

export const automationEndpoints = {
  list: (): Promise<GetAutomationsResponse> => get('/api/automations'),
  create: (request: CreateAutomationRequest): Promise<CreateAutomationResponse> =>
    post('/api/automations', request),
  update: (request: UpdateAutomationRequest): Promise<UpdateAutomationResponse> =>
    put(`/api/automations/${encodeURIComponent(request.id)}`, request),
  duplicate: (id: string): Promise<DuplicateAutomationResponse> =>
    post(`/api/automations/${encodeURIComponent(id)}/duplicate`, {}),
  delete: (id: string): Promise<DeleteAutomationResponse> =>
    del(`/api/automations/${encodeURIComponent(id)}`),
};

export const settingsEndpoints = {
  getAppearance: (): Promise<GetAppearanceSettingsResponse> => get('/api/settings/appearance'),
  updateAppearance: (
    request: UpdateAppearanceSettingsRequest,
  ): Promise<UpdateAppearanceSettingsResponse> => put('/api/settings/appearance', request),

  getAutostart: (): Promise<GetAutostartSettingsResponse> => get('/api/settings/autostart'),
  updateAutostart: (
    request: UpdateAutostartSettingsRequest,
  ): Promise<UpdateAutostartSettingsResponse> => put('/api/settings/autostart', request),

  getNetwork: (): Promise<GetNetworkSettingsResponse> => get('/api/settings/network'),
  updateNetwork: (request: UpdateNetworkSettingsRequest): Promise<UpdateNetworkSettingsResponse> =>
    put('/api/settings/network', request),
  updateNetworkTlsCertificate: (
    request: UpdateNetworkTlsCertificateRequest,
  ): Promise<UpdateNetworkSettingsResponse> =>
    put('/api/settings/network/tls/certificate', request),
  reissueNetworkTlsCertificate: (): Promise<UpdateNetworkSettingsResponse> =>
    post('/api/settings/network/tls/certificate/reissue', {}),
  regenerateNetworkTlsCertificateAuthority: (): Promise<UpdateNetworkSettingsResponse> =>
    post('/api/settings/network/tls/certificate-authority/regenerate', {}),

  getLogging: (): Promise<GetLoggingSettingsResponse> => get('/api/settings/logging'),
  updateLogging: (request: UpdateLoggingSettingsRequest): Promise<UpdateLoggingSettingsResponse> =>
    put('/api/settings/logging', request),

  getHttp: (): Promise<GetHttpSettingsResponse> => get('/api/settings/http'),
  updateHttp: (request: UpdateHttpSettingsRequest): Promise<UpdateHttpSettingsResponse> =>
    put('/api/settings/http', request),

  getDeveloper: (): Promise<GetDeveloperSettingsResponse> => get('/api/settings/developer'),
  updateDeveloper: (
    request: UpdateDeveloperSettingsRequest,
  ): Promise<UpdateDeveloperSettingsResponse> => put('/api/settings/developer', request),

  getExtensionSettings: (): Promise<GetExtensionSettingsResponse> =>
    get('/api/settings/extensions'),
  updateExtensionSettings: (
    request: UpdateExtensionSettingsRequest,
  ): Promise<UpdateExtensionSettingsResponse> => put('/api/settings/extensions', request),

  getLicense: (): Promise<CompanionLicenseStatus> => get('/api/settings/license'),
  redeemPromoCode: (code: string): Promise<RedeemCompanionPromoCodeResponse> =>
    post('/api/settings/license/promo-code', { code }),

  getAdb: (): Promise<GetAdbSettingsResponse> => get('/api/settings/adb'),
  updateAdb: (request: UpdateAdbSettingsRequest): Promise<UpdateAdbSettingsResponse> =>
    put('/api/settings/adb', request),
  restartAdbServer: (): Promise<RestartAdbServerResponse> =>
    post('/api/settings/adb/restart-server', {}),
  connectAdbDevice: (request: ConnectAdbDeviceRequest): Promise<ConnectAdbDeviceResponse> =>
    post('/api/settings/adb/connect', request),
  downloadPlatformTools: (): Promise<DownloadAdbPlatformToolsResponse> =>
    post('/api/settings/adb/download-platform-tools', {}),

  getUsb: (): Promise<GetNativeUsbSettingsResponse> => get('/api/settings/usb'),
  refreshUsb: (): Promise<GetNativeUsbSettingsResponse> => post('/api/settings/usb/refresh', {}),
  updateUsb: (request: UpdateNativeUsbSettingsRequest): Promise<UpdateNativeUsbSettingsResponse> =>
    put('/api/settings/usb', request),
  connectUsbDevice: (
    request: ConnectNativeUsbDeviceRequest,
  ): Promise<ConnectNativeUsbDeviceResponse> => post('/api/settings/usb/connect', request),
  forgetUsbDevice: (
    request: ForgetNativeUsbDeviceRequest,
  ): Promise<ForgetNativeUsbDeviceResponse> => post('/api/settings/usb/forget', request),

  getLockScreen: (): Promise<GetLockScreenSettingsResponse> => get('/api/settings/lock-screen'),
  updateLockScreen: (
    request: UpdateLockScreenSettingsRequest,
  ): Promise<UpdateLockScreenSettingsResponse> => put('/api/settings/lock-screen', request),

  getDataDirectory: (): Promise<GetDataDirectoryResponse> => get('/api/host/data-directory'),
  openDataDirectory: (): Promise<OpenDataDirectoryResponse> =>
    post('/api/host/data-directory/open', {}),
  restartHost: (reason?: string): Promise<RestartApplicationResponse> =>
    post('/api/host/restart', { reason }),
};

export const developerEndpoints = {
  getActions: (): Promise<GetActionsResponse> => get('/api/actions'),
  runAction: (request: ExecuteActionRequest): Promise<ExecuteActionResponse> =>
    post('/api/actions/run', request),
  runActionFlow: (request: RunActionFlowRequest): Promise<RunActionFlowResponse> =>
    post('/api/actions/run-flow', request),

  getEvents: (): Promise<GetEventDefinitionsResponse> => get('/api/events'),
  triggerEvent: (request: TriggerEventRequest): Promise<TriggerEventResponse> =>
    post('/api/events/trigger', request),

  renderTemplate: (request: RenderTemplateRequest): Promise<RenderTemplateResponse> =>
    post('/api/templates/render', request),
  evaluateCondition: (request: EvaluateConditionRequest): Promise<EvaluateConditionResponse> =>
    post('/api/templates/evaluate-condition', request),
  evaluateExpression: (request: EvaluateExpressionRequest): Promise<EvaluateExpressionResponse> =>
    post('/api/templates/evaluate-expression', request),

  getLogs: (request?: GetLogsRequest): Promise<GetLogsResponse> => {
    const query = new URLSearchParams();
    if (request?.source) {
      query.set('source', request.source);
    }
    if (request?.levels && request.levels.length > 0) {
      query.set('levels', request.levels.join(','));
    }
    if (request?.limit !== undefined) {
      query.set('limit', String(request.limit));
    }
    if (request?.search) {
      query.set('search', request.search);
    }
    if (request?.from) {
      query.set('from', request.from);
    }
    if (request?.to) {
      query.set('to', request.to);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return get(`/api/logs${suffix}`);
  },
  getLogSources: (): Promise<GetLogSourcesResponse> => get('/api/logs/sources'),
};

export type { DeviceLoginInfo };
