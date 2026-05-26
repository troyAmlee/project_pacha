import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "xxica.lang";
const DEFAULT_LANG = "en";
const SUPPORTED = ["en", "es"];

const dictionaries = {
  en: {
    common: {
      logIn: "Log in",
      logOut: "Log out",
      signUp: "Sign up",
      createAccount: "Create account",
      cancel: "Cancel",
      save: "Save",
      back: "Back",
      loading: "Loading...",
      retry: "Retry",
      newRoute: "New route",
      edit: "Edit",
      delete: "Delete",
      languageLabel: "Language",
      languageEn: "EN",
      languageEs: "ES"
    },
    topbar: {
      kicker: "Minneapolis ride collective",
      navRoster: "Roster",
      navRoutes: "Routes",
      navGroups: "Groups",
      navPhotos: "Photos",
      navJournal: "Journal"
    },
    auth: {
      loginKicker: "Member login",
      loginTitle: "Welcome back to the crew.",
      loginCta: "Log in",
      loginBusy: "Logging in...",
      loginSwitchPrompt: "New to the collective?",
      loginSwitchAction: "Create a rider account",
      signupKicker: "Join the collective",
      signupTitle: "Build your rider profile.",
      signupCta: "Create account",
      signupBusy: "Creating account...",
      signupSwitchPrompt: "Already have an account?",
      signupSwitchAction: "Log in",
      fieldEmail: "Email",
      fieldEmailPlaceholder: "rider@xxica.com",
      fieldPassword: "Password",
      fieldPasswordPlaceholderLogin: "Your collective password",
      fieldPasswordPlaceholderSignup: "At least 8 characters",
      fieldName: "Rider name",
      fieldNamePlaceholder: "Asha Patel",
      fieldNeighborhood: "Neighborhood",
      fieldNeighborhoodPlaceholder: "Longfellow",
      fieldPace: "Ride pace",
      fieldBio: "What do you ride for?",
      fieldBioPlaceholder: "Bridge laps before work, coffee rides on weekends, fall trail days.",
      checkingSession: "Checking your session..."
    },
    locked: {
      lead: "Log in to {action}.",
      body: "Xxica credits every route, photo, and journal post to the rider who shared it, so contributing needs a collective account.",
      actionShareRoute: "share a route",
      actionPostPhoto: "post a photo",
      actionWriteJournal: "write in the journal",
      actionJoinGroup: "join this ride group",
      actionCreateGroup: "create or join a ride group",
      actionFavorite: "save favorites"
    },
    home: {
      heroEyebrow: "Bike collective - Minneapolis",
      heroTitle: "Routes, photos, groups, and a shared journal for the riders who keep showing up.",
      heroSummary:
        "Xxica runs as the collective's working tool: riders join the crew, save route lines with real geometry, organize into groups, and open a live ride screen when it is time to roll out.",
      heroCtaBuildRoute: "Build a route",
      heroCtaJoin: "Join the collective",
      heroCtaBrowse: "Browse route board",
      heroPinRiver: "River loop",
      heroPinGreenway: "Greenway",
      heroPinNorthside: "Northside",
      statMembers: "Members",
      statSharedMiles: "Shared miles",
      statGroups: "Ride groups",
      statRides: "Logged rides",
      loadingBoard: "Loading the Minneapolis ride board...",
      dataUnavailable: "Collective data is unavailable.",
      rosterKicker: "Collective roster",
      rosterTitle: "Riders join with a profile that feels more like a crew than a signup form.",
      rosterBody:
        "The roster gathers the people in the community, their neighborhood, their ride pace, and what kind of riding they are here for.",
      rosterWelcomeTitle: "You are riding with the crew, {name}.",
      rosterWelcomeBody:
        "Your profile is live on the roster. Every route, photo, journal post, group, and ride log is credited to you.",
      rosterJoinTitle: "Join the Xxica crew.",
      rosterJoinBody:
        "Create a rider profile to share routes, post ride photos, join groups, and write in the collective journal.",
      routeBoardKicker: "Route board",
      routeBoardTitle: "Share the loops people actually ride, not just the ones on a brochure map.",
      routeBoardLead: "Routes now carry geometry, so riders can save a line, open it later in the ride screen, and follow it with live GPS.",
      routeBuildHeading: "Build routes with geometry.",
      routeBuildBody:
        "Draw a route point by point or capture one live with GPS. Every saved route can open in the ride screen later with the line and Greenway guide intact.",
      routeBuildCta: "Open route builder",
      routeBuildSeeGroups: "See groups",
      routeBoardEmpty: "No routes shared yet.",
      suggestedClubTitle: "Collective picks",
      suggestedClubDescription:
        "These are the best routes to load first if you are new to the board or just want a dependable ride.",
      groupsKicker: "Ride groups",
      groupsTitle: "Small crews can pin routes, gather members, and launch rides together.",
      groupsLead:
        "Groups turn the app from a shared board into a real collective structure: recurring crews, pinned routes, and ride screens that open from the same page.",
      groupsViewAll: "Browse all groups",
      groupsCardPinned: "Pinned routes {count}",
      groupsCardRiders: "{count} riders",
      groupsCardMiles: "{miles} logged",
      groupsCardStartedBy: "Started by",
      groupsCardOpen: "Open group",
      groupsEmpty: "No groups have been started yet.",
      photosKicker: "Photo wall",
      photosTitle: "Let ride days leave proof: river light, trail dust, coffee stops, and weather.",
      photosLead:
        "The backend stores uploads locally, so this MVP already supports real image sharing instead of mock photo cards.",
      photoFormRouteTag: "Route tag",
      photoFormRouteTagPlaceholder: "Greenway shakeout",
      photoFormCaption: "Caption",
      photoFormCaptionPlaceholder:
        "Tailwind through the corridor and a stop for cardamom buns after the ride.",
      photoFormUpload: "Upload image",
      photoFormSubmit: "Post photo",
      photoFormBusy: "Uploading...",
      photoSuccess: "Photo posted by {name}.",
      photosEmpty: "No ride photos posted yet.",
      journalKicker: "Collective journal",
      journalTitle: "Give the crew a running blog space for ride reports, advocacy notes, and weekend plans.",
      journalLead:
        "This is the editorial layer of the app: longer updates, recurring series, and the voice of the collective over time.",
      journalFormTitle: "Post title",
      journalFormTitlePlaceholder: "Sunday social route notes",
      journalFormBody: "Story",
      journalFormBodyPlaceholder:
        "Share route conditions, a ride recap, a volunteer note, or what the crew should know before next weekend.",
      journalFormSubmit: "Publish entry",
      journalFormBusy: "Publishing...",
      journalSuccess: "Journal post published: {title}.",
      journalEmpty: "No journal entries written yet."
    },
    profile: {
      kicker: "Rider profile",
      notFound: "That rider is not on the roster.",
      loading: "Loading rider profile...",
      backToBoard: "Back to the ride board",
      editProfile: "Edit profile",
      badgeMemberSince: "Riding with the crew since {date}",
      badgeMilesVeterano: "{miles} ridden - Veteran",
      badgeMilesCenturion: "{miles} ridden - Centurion",
      badgeMilesRegular: "{miles} ridden - Regular",
      badgeMilesRolling: "{miles} ridden - Just rolling",
      badgeGroupSingle: "{count} group",
      badgeGroupPlural: "{count} groups",
      badgeRideSingle: "{count} ride logged",
      badgeRidePlural: "{count} rides logged",
      sectionGroupsKicker: "Ride groups",
      sectionGroupsOwn: "Groups you ride with right now.",
      sectionGroupsOther: "Groups {name} rides with right now.",
      sectionGroupsEmpty: "No group memberships yet.",
      sectionBuddiesKicker: "Ride buddies",
      sectionBuddiesOwn: "Riders you share groups with.",
      sectionBuddiesOther: "Riders {name} shares groups with.",
      sectionBuddiesEmpty: "No ride buddies yet - join a group to connect with riders.",
      sectionActivityKicker: "Recent activity",
      sectionActivityOwn: "What you have been up to.",
      sectionActivityOther: "What {name} has been up to.",
      sectionActivityEmpty: "No activity yet.",
      sectionFavoritesKicker: "Favorite routes",
      sectionFavoritesOwn: "Loops you keep coming back to.",
      sectionFavoritesOther: "Loops {name} keeps coming back to.",
      sectionFavoritesEmpty: "No favorite routes pinned yet.",
      sectionRoutesKicker: "Routes shared",
      sectionRoutesOwn: "Routes you put on the board.",
      sectionRoutesOther: "Routes {name} puts on the board.",
      sectionRoutesEmpty: "No routes shared yet.",
      sectionPhotosKicker: "Photo drops",
      sectionPhotosOwn: "Moments you posted from the saddle.",
      sectionPhotosOther: "Moments {name} posted from the saddle.",
      sectionPhotosEmpty: "No ride photos posted yet.",
      sectionJournalKicker: "Journal entries",
      sectionJournalOwn: "Notes you added to the collective journal.",
      sectionJournalOther: "Notes {name} added to the collective journal.",
      sectionJournalEmpty: "No journal entries written yet.",
      activityRoute: "Shared a route",
      activityPhoto: "Posted a photo",
      activityPost: "Wrote in the journal",
      buddySharedSingle: "{count} shared group",
      buddySharedPlural: "{count} shared groups"
    },
    profileEdit: {
      previewKicker: "Preview",
      previewHint: "Paste a direct image URL above to preview your avatar here.",
      previewHintWarn: "That image URL did not load - paste a direct link to a JPG, PNG, or webp.",
      legendIdentity: "Identity",
      legendRidingStyle: "Riding style",
      legendAbout: "About",
      labelNeighborhood: "Neighborhood",
      labelAvatar: "Avatar URL",
      labelAvatarPlaceholder: "https://example.com/rider.jpg",
      labelPace: "Ride pace",
      labelBike: "Bike",
      labelBikePlaceholder: "Steel all-road with fenders",
      labelBio: "Rider bio",
      labelBioPlaceholder: "Bridge laps before work, coffee rides on weekends, fall trail days.",
      counter: "{count} / {max}",
      bioOverLimit: "Bio is over the {max}-character limit.",
      saveButton: "Save profile",
      saveBusy: "Saving..."
    },
    metrics: {
      milesBiked: "Miles biked",
      ridesTaken: "Rides taken",
      routesTaken: "Routes taken",
      longestRide: "Longest ride"
    },
    pace: {
      easy: "Easy cruise",
      steady: "Steady spin",
      fast: "Fast group"
    },
    terrain: {
      "city streets": "City streets",
      greenway: "Greenway",
      gravel: "Gravel",
      "mixed surface": "Mixed surface"
    },
    units: {
      pace: "pace"
    },
    routeCard: {
      sharedBy: "Shared by {name}",
      viewRoute: "Open ride screen",
      editRoute: "Edit route",
      distance: "{miles}",
      terrain: "Terrain: {terrain}",
      start: "Start: {start}"
    },
    groups: {
      loading: "Loading ride groups...",
      pageTitle: "Organize recurring crews, pin trusted routes, and launch ride screens from one place.",
      pageLead:
        "Groups give the collective a structure beyond the shared feed: each one has its own roster, saved routes, and a simple join flow.",
      kicker: "Collective groups",
      createGroupName: "Group name",
      createGroupNamePlaceholder: "River Dawns",
      createDescription: "Description",
      createDescriptionPlaceholder:
        "Who the group is for, what pace it likes, and what kind of routes it pins.",
      createSubmit: "Create group",
      createBusy: "Creating group...",
      countRiders: "{count} riders",
      pinnedRoutes: "{count} pinned routes",
      milesLogged: "{miles} logged",
      startedBy: "Started by",
      viewGroup: "View group",
      join: "Join",
      joining: "Joining...",
      joinedSuccess: "You joined the group."
    },
    groupDetail: {
      kicker: "Group detail",
      loading: "Loading ride group...",
      notFound: "That group does not exist.",
      backToGroups: "Back to groups",
      statMembers: "Members",
      statPinned: "Pinned routes",
      statMiles: "Miles logged",
      statFounder: "Founder",
      alreadyMember: "You are already part of this group.",
      joinGroup: "Join group",
      joining: "Joining...",
      pinLabel: "Pin a route for the group",
      pinSubmit: "Pin route",
      pinBusy: "Pinning...",
      pinSuccess: "Route pinned to the group.",
      rosterKicker: "Member roster",
      rosterTitle: "The riders currently in this group.",
      pinnedKicker: "Pinned routes",
      pinnedTitle: "Routes this crew keeps ready for ride day.",
      pinnedEmpty: "No routes have been pinned yet."
    },
    routeBuilder: {
      loadingBuilder: "Loading route builder...",
      loadingEditor: "Loading route editor...",
      notOnBoard: "That route is not on the board.",
      ownerOnly: "You can only edit routes that you created.",
      backToBoard: "Back to route board",
      backToRide: "Back to ride screen",
      kickerEditor: "Route editor",
      kickerBuilder: "Route builder",
      titleEditor: "Refine the route before the next rider opens it.",
      titleBuilder: "Make the route easy to read before anyone tries to follow it on a bike.",
      lead:
        "Saved routes keep their geometry, and Greenway routes get a dedicated guide overlay so riders can tell at a glance where the corridor sits on the map.",
      modeSketch: "Sketch route",
      modeRecord: "Record live ride",
      guideHowKicker: "How to use it",
      guideSketchTitle: "Sketch first, then save.",
      guideRecordTitle: "Record the line as you ride.",
      guideSketchLead:
        "Sketch a clean line first, then save it so the GPS ride screen has a route to follow.",
      guideRecordLead:
        "Record a live ride when you want the route to come directly from the street or trail.",
      stepSketch1: "Tap the route in order, from start to finish.",
      stepRecord1:
        "Grant location access and start GPS capture at the real start point.",
      stepGreenway:
        "Keep the Midtown Greenway guide in view so your line matches the corridor.",
      stepName:
        "Name the route and label the start so riders know where to roll out.",
      stepSave:
        "Save the route, then open the ride screen to follow it live or log the ride.",
      labelTitle: "Route name",
      labelTitlePlaceholder: "West River recovery loop",
      labelStart: "Start point label",
      labelStartPlaceholder: "Stone Arch Bridge",
      labelTerrain: "Terrain",
      labelNotes: "Ride notes",
      labelNotesPlaceholder:
        "What should another rider know before they follow this route?",
      statLength: "Path length",
      statRecorded: "Recorded time",
      statPoints: "Points",
      undoPoint: "Undo last point",
      clearSketch: "Clear sketch",
      startGps: "Start GPS capture",
      stopGps: "Stop GPS capture",
      resetTrace: "Reset ride trace",
      submitSave: "Save route to collective",
      submitSaving: "Saving route...",
      submitEdit: "Save changes",
      submitEditing: "Saving changes...",
      deleteRoute: "Delete route",
      deletingRoute: "Deleting route...",
      mapNoteSketch:
        "Sketch mode: every tap adds a point, so use turns, crossings, and clear regroup spots.",
      mapNoteRecord:
        "Live mode: GPS points appear as they are captured, so keep the page open until the ride is done.",
      gpsClickStart:
        "Click the map to draw a route or switch to live GPS recording.",
      gpsEditing: "Editing {title}. Update the line or notes, then save your changes.",
      errorMinPoints: "Add at least two points to the route before saving it.",
      routeSnapping: "Routing sketch through bike-friendly roads and trails...",
      routeSnapFailed: "Bike routing was unavailable, so the sketched line will be saved.",
      routePreviewReady: "{provider} preview ready.",
      routePreviewProvider: "Bike route",
      gpsSnapping: "Snapping recorded GPS to bike-friendly roads and trails...",
      gpsSnapFailed: "Bike route matching was unavailable, so the raw GPS line will be saved.",
      gpsLoadedSuggestion: "{title} is loaded as a starting point. Adjust the line or notes, then save your version.",
      gpsCleared: "Recording cleared. Start GPS capture again when you are ready.",
      pathCleared: "Path cleared. Click the map to lay down a new route.",
      gpsWaiting: "Waiting for GPS points. Keep this page open while you ride.",
      gpsLive: "GPS capture is live with tighter points. Stop recording when the route is complete.",
      sketchActive: "Sketch mode is active. Click turns, regroup points, or trail bends on the map.",
      recordActive: "Live ride mode is active. Start GPS capture when you are rolling and keep this page open.",
      addressSearchPlaceholder: "Search an address or place",
      addressSearchModeLabel: "Address insert mode",
      addressSearchAppend: "Append",
      addressSearchReplace: "Replace selected",
      addressSearchReplaceHint: "Tap a point on the map first, then search to replace it.",
      addressSearchLoading: "Looking...",
      addressSearchEmpty: "No matches near here.",
      addressSearchError: "Address search failed. Try again.",
      addressAppended: "Added {address} to the route.",
      addressReplaced: "Replaced selected point with {address}."
    },
    rideScreen: {
      kicker: "Ride screen",
      loading: "Loading the ride screen...",
      notOnBoard: "That route is not on the board.",
      lead:
        "Follow the saved line, watch your live position, and log a completed ride when you are done.",
      editRoute: "Edit route",
      deleteRoute: "Delete route",
      deletingRoute: "Deleting route...",
      cueKicker: "Live route cue",
      cueStartLabel: "Start: {start}",
      cueTerrainLabel: "Terrain: {terrain}",
      cueDistanceFromLine: "Distance from line: {miles}",
      cueRemaining: "Remaining: {miles}",
      cueActiveLeg: "Active leg: {miles}",
      cueRoutingLoading: "Routing roads...",
      cueRoutingFallback: "Saved line fallback",
      cueRoutingWith: "{provider} routing",
      cueStreetCues: "Street-name cues",
      directionsShow: "Directions",
      directionsHide: "Hide directions",
      voiceOff: "Voice navigation",
      voiceOn: "Voice on",
      voiceStatusOff: "Voice guidance off",
      voiceStatusOn: "Voice guidance on. Turn prompts will announce as they approach.",
      voiceStatusWait: "Voice guidance waits for GPS tracking.",
      voiceUnsupported: "This browser does not support spoken navigation prompts.",
      bearingModeLabel: "Map bearing mode",
      bearingRoute: "Route",
      bearingCompass: "Compass",
      mapControlsLabel: "Map controls",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      recenterMap: "GPS",
      compassToggleOff: "Compass off",
      compassToggleOn: "Compass on",
      compassDenied: "Motion access blocked",
      statRouteLength: "Route length",
      statElapsed: "Elapsed",
      statDistanceFromLine: "Distance from line",
      statTrail: "Your trail",
      controlsTitle: "Live ride controls",
      controlsBody:
        "Start GPS guidance when you roll out from the saved start. If you just want to log the effort, you can run the timer without live location.",
      pauseGps: "Pause GPS guidance",
      startGps: "Start GPS guidance",
      startWithout: "Start ride without GPS",
      reverseCourse: "Reverse course",
      forwardCourse: "Forward course",
      backToBoard: "Back to board",
      supportNote:
        "Geolocation works on localhost in development. On a deployed site it will need HTTPS before browsers will share live position.",
      completeRide: "Log finished ride",
      completing: "Logging ride...",
      pinnedByGroups: "Pinned by groups",
      pinnedEmpty: "No groups have pinned this route yet.",
      suggestedTitle: "Suggested next rides",
      suggestedDescription:
        "When this ride is done, queue up the next route without going back to a blank board.",
      headlineHeadToStart: "Head to start",
      headlineReturnRoute: "Return to route",
      headlineSlightDrift: "Slight drift",
      headlineRouteCheck: "Route check needed",
      headlineWaitingGps: "Waiting for GPS lock",
      headlineGuidanceReady: "Guidance ready",
      detailToStartFallback:
        "Head to the saved start first. The route-to-finish leg starts once you reach it.",
      detailSlightDrift:
        "You are a little off the saved line. Use the map to move back toward the route before the gap grows.",
      detailRouteCheck:
        "You are clearly off the saved line. Pause, look at the map, and head back toward the highlighted route.",
      detailReturn:
        "You are {miles} from the saved line. Move back toward the highlighted route.",
      detailWaitingGps:
        "Your location will appear once the browser locks onto your position.",
      detailGuidanceReady:
        "Start GPS guidance when you are at the route start, or run the timer if you only want to log the ride.",
      rideLoggedFeedback: "Ride logged: {miles} in {duration}.",
      routeDeletedFeedback: "Route deleted.",
      confirmDelete:
        "Delete \"{title}\"? This removes it from the route board and any group pins.",
      geoUnsupported: "This browser does not support live geolocation.",
      geoDenied:
        "Location access was denied. Use draw mode or allow geolocation for this site.",
      geoFailed: "Live GPS capture failed. Try again or use draw mode.",
      trackDenied:
        "Location access was denied. Allow geolocation for this site to follow the route live.",
      trackFailed: "Live route tracking failed. Try again in a stronger GPS signal.",
      saveSuccess: "Route saved. Open the ride screen to follow it live.",
      saveSuccessProvider: "Route saved with {provider} bike route matching. Open the ride screen to follow it live.",
      saveSuccessRide: "Route saved and your recorded ride was logged.",
      saveSuccessRideProvider: "Route saved with {provider} bike route matching and your recorded ride was logged.",
      saveUpdated: "Route updated.",
      saveUpdatedProvider: "Route updated with {provider} bike route matching.",
      metaStart: "Start",
      metaTerrain: "Terrain",
      metaNotes: "Notes"
    },
    routeMap: {
      legendRoute: "Route line",
      legendTrail: "Your trail",
      legendGuide: "Greenway guide",
      legendYou: "You",
      badgeGreenway: "Greenway line",
      badgeMixed: "Mixed surface",
      badgeCity: "City route",
      markerStart: "Start",
      markerFinish: "Finish",
      markerRider: "You",
      summaryTotal: "{miles}",
      summaryStart: "Start: {start}"
    },
    directions: {
      kicker: "Turn-by-turn",
      title: "Directions",
      loading: "Loading street directions.",
      idle: "Start GPS guidance to see the active step.",
      sectionToStart: "To route start",
      sectionRoute: "Route to finish",
      sectionSaved: "Saved route line",
      hide: "Hide",
      steps: "{count} steps",
      current: "Current",
      stepSavedStart: "Start at {start}",
      stepSavedFollow: "Follow the highlighted route line",
      stepSavedArrive: "Arrive at finish",
      detailContinue: "Continue following the route.",
      detailVia: "Via {street}",
      detailFallback: "Begin at the saved start point.",
      detailSavedFollow:
        "Street directions will appear here when road routing is available.",
      detailSavedFinish: "Finish at the end of the saved route."
    },
    favorite: {
      add: "Save favorite",
      remove: "Saved",
      busy: "Saving..."
    },
    suggested: {
      labelBest: "Best first ride",
      labelClassic: "Minneapolis classic",
      labelLong: "Longer training pull",
      labelQuick: "Quick spin",
      labelFavorite: "Crew favorite",
      noteBest:
        "Smooth, forgiving mileage with the Greenway guide layered right on the map.",
      noteClassic:
        "A good city-line ride when you want landmarks, bridges, and an easy read of the route.",
      noteLong:
        "More distance, fewer repeated turns, and a better option when the group wants a bigger day.",
      noteQuick:
        "A shorter option when you want a route that is easy to load and follow.",
      noteFavorite:
        "Shared recently by the collective and ready to open in the ride screen.",
      title: "Start from a proven line",
      description:
        "Use a collective route as a starting template instead of drawing from a blank map.",
      action: "Load into builder"
    }
  },
  es: {
    common: {
      logIn: "Iniciar sesión",
      logOut: "Cerrar sesión",
      signUp: "Crear cuenta",
      createAccount: "Crear cuenta",
      cancel: "Cancelar",
      save: "Guardar",
      back: "Volver",
      loading: "Cargando...",
      retry: "Reintentar",
      newRoute: "Nueva ruta",
      edit: "Editar",
      delete: "Eliminar",
      languageLabel: "Idioma",
      languageEn: "EN",
      languageEs: "ES"
    },
    topbar: {
      kicker: "Colectivo ciclista de Mineápolis",
      navRoster: "Roster",
      navRoutes: "Rutas",
      navGroups: "Grupos",
      navPhotos: "Fotos",
      navJournal: "Diario"
    },
    auth: {
      loginKicker: "Acceso de miembros",
      loginTitle: "Bienvenido — de regreso a la banda.",
      loginCta: "Entrar",
      loginBusy: "Entrando...",
      loginSwitchPrompt: "¿Nuevo en el colectivo?",
      loginSwitchAction: "Crea tu cuenta de rider",
      signupKicker: "Únete al colectivo",
      signupTitle: "Arma tu perfil de rider.",
      signupCta: "Crear cuenta",
      signupBusy: "Creando cuenta...",
      signupSwitchPrompt: "¿Ya tienes cuenta?",
      signupSwitchAction: "Inicia sesión",
      fieldEmail: "Correo",
      fieldEmailPlaceholder: "rider@xxica.com",
      fieldPassword: "Contraseña",
      fieldPasswordPlaceholderLogin: "Tu contraseña del colectivo",
      fieldPasswordPlaceholderSignup: "Mínimo 8 caracteres",
      fieldName: "Nombre",
      fieldNamePlaceholder: "Asha Patel",
      fieldNeighborhood: "Colonia",
      fieldNeighborhoodPlaceholder: "Longfellow",
      fieldPace: "Ritmo",
      fieldBio: "¿Por qué andas en bici?",
      fieldBioPlaceholder:
        "Vueltas al puente antes del trabajo, rides al café los sábados, días de monte en otoño.",
      checkingSession: "Verificando tu sesión..."
    },
    locked: {
      lead: "Inicia sesión para {action}.",
      body: "Xxica acredita cada ruta, foto y entrada del diario al rider que la compartió, así que para contribuir necesitas una cuenta.",
      actionShareRoute: "compartir una ruta",
      actionPostPhoto: "subir una foto",
      actionWriteJournal: "escribir en el diario",
      actionJoinGroup: "unirte a este grupo",
      actionCreateGroup: "crear o unirte a un grupo",
      actionFavorite: "guardar favoritos"
    },
    home: {
      heroEyebrow: "Colectivo ciclista · Mineápolis",
      heroTitle: "Rutas, fotos, grupos y un diario compartido para los riders que siempre llegan.",
      heroSummary:
        "Xxica es la herramienta del colectivo: los riders entran a la banda, guardan rutas con geometría real, se organizan en grupos y abren la pantalla en vivo cuando es hora de rodar.",
      heroCtaBuildRoute: "Crear ruta",
      heroCtaJoin: "Únete al colectivo",
      heroCtaBrowse: "Ver tablón de rutas",
      heroPinRiver: "Vuelta al río",
      heroPinGreenway: "Greenway",
      heroPinNorthside: "Northside",
      statMembers: "Miembros",
      statSharedMiles: "Millas compartidas",
      statGroups: "Grupos",
      statRides: "Rides registrados",
      loadingBoard: "Cargando el tablón de rutas de Mineápolis...",
      dataUnavailable: "No se pudieron cargar los datos del colectivo.",
      rosterKicker: "Roster del colectivo",
      rosterTitle: "Los riders entran con un perfil que se siente más a banda que a formulario.",
      rosterBody:
        "El roster reúne a la gente del colectivo, su colonia, su ritmo y el tipo de ciclismo que les late.",
      rosterWelcomeTitle: "Estás rodando con la banda, {name}.",
      rosterWelcomeBody:
        "Tu perfil ya está en el roster. Cada ruta, foto, entrada del diario, grupo y ride registrado quedan a tu nombre.",
      rosterJoinTitle: "Únete a la banda Xxica.",
      rosterJoinBody:
        "Arma tu perfil para compartir rutas, subir fotos, unirte a grupos y escribir en el diario.",
      routeBoardKicker: "Tablón de rutas",
      routeBoardTitle: "Comparte las vueltas que la gente realmente rueda, no las del folleto.",
      routeBoardLead:
        "Las rutas ya cargan geometría, así que los riders pueden guardar una línea, abrirla después en la pantalla de ride y seguirla con GPS en vivo.",
      routeBuildHeading: "Crea rutas con geometría real.",
      routeBuildBody:
        "Traza una ruta punto por punto o captúrala en vivo con GPS. Cada ruta guardada se abre después en la pantalla de ride con la línea y la guía del Greenway intactas.",
      routeBuildCta: "Abrir creador de rutas",
      routeBuildSeeGroups: "Ver grupos",
      routeBoardEmpty: "Aún no hay rutas compartidas.",
      suggestedClubTitle: "Elecciones del colectivo",
      suggestedClubDescription:
        "Las mejores rutas para arrancar si eres nuevo en el tablón o solo quieres un ride confiable.",
      groupsKicker: "Grupos",
      groupsTitle: "Las bandas chicas pueden fijar rutas, juntar miembros y arrancar rides en grupo.",
      groupsLead:
        "Los grupos convierten la app en una estructura de colectivo: bandas recurrentes, rutas fijadas y pantallas de ride que se abren desde la misma página.",
      groupsViewAll: "Ver todos los grupos",
      groupsCardPinned: "Rutas fijadas {count}",
      groupsCardRiders: "{count} riders",
      groupsCardMiles: "{miles} registradas",
      groupsCardStartedBy: "Iniciado por",
      groupsCardOpen: "Abrir grupo",
      groupsEmpty: "Aún no se ha creado ningún grupo.",
      photosKicker: "Muro de fotos",
      photosTitle: "Que los días de ride dejen huella: luz de río, polvo de monte, paradas de café y clima.",
      photosLead:
        "El backend guarda las subidas localmente, así que este MVP ya soporta fotos reales en vez de tarjetas falsas.",
      photoFormRouteTag: "Etiqueta de ruta",
      photoFormRouteTagPlaceholder: "Shakeout del Greenway",
      photoFormCaption: "Descripción",
      photoFormCaptionPlaceholder:
        "Viento a favor por el corredor y parada por panes de cardamomo después del ride.",
      photoFormUpload: "Subir imagen",
      photoFormSubmit: "Publicar foto",
      photoFormBusy: "Subiendo...",
      photoSuccess: "Foto publicada por {name}.",
      photosEmpty: "Aún no hay fotos.",
      journalKicker: "Diario del colectivo",
      journalTitle: "Un espacio para reportes de ride, notas de advocacy y planes del fin de semana.",
      journalLead:
        "Es la capa editorial de la app: notas más largas, series recurrentes y la voz del colectivo a lo largo del tiempo.",
      journalFormTitle: "Título",
      journalFormTitlePlaceholder: "Notas del social dominical",
      journalFormBody: "Historia",
      journalFormBodyPlaceholder:
        "Comparte condiciones de la ruta, un recap del ride, una nota de voluntariado o lo que la banda debería saber antes del próximo fin de semana.",
      journalFormSubmit: "Publicar entrada",
      journalFormBusy: "Publicando...",
      journalSuccess: "Entrada publicada: {title}.",
      journalEmpty: "Aún no hay entradas en el diario."
    },
    profile: {
      kicker: "Perfil del rider",
      notFound: "Ese rider no está en el roster.",
      loading: "Cargando perfil del rider...",
      backToBoard: "Volver al tablón",
      editProfile: "Editar perfil",
      badgeMemberSince: "Rodando con la banda desde {date}",
      badgeMilesVeterano: "{miles} rodadas · Veterano",
      badgeMilesCenturion: "{miles} rodadas · Centurión",
      badgeMilesRegular: "{miles} rodadas · Regular",
      badgeMilesRolling: "{miles} rodadas · Recién empezando",
      badgeGroupSingle: "{count} grupo",
      badgeGroupPlural: "{count} grupos",
      badgeRideSingle: "{count} ride registrado",
      badgeRidePlural: "{count} rides registrados",
      sectionGroupsKicker: "Grupos",
      sectionGroupsOwn: "Grupos con los que ruedas ahora mismo.",
      sectionGroupsOther: "Grupos con los que rueda {name} ahora mismo.",
      sectionGroupsEmpty: "Aún sin membresías de grupo.",
      sectionBuddiesKicker: "Compañeros de ride",
      sectionBuddiesOwn: "Riders con los que compartes grupos.",
      sectionBuddiesOther: "Riders con los que {name} comparte grupos.",
      sectionBuddiesEmpty: "Aún sin compañeros — únete a un grupo para conectar con riders.",
      sectionActivityKicker: "Actividad reciente",
      sectionActivityOwn: "Lo que has estado haciendo.",
      sectionActivityOther: "Lo que ha estado haciendo {name}.",
      sectionActivityEmpty: "Aún sin actividad.",
      sectionFavoritesKicker: "Rutas favoritas",
      sectionFavoritesOwn: "Vueltas a las que regresas siempre.",
      sectionFavoritesOther: "Vueltas a las que {name} regresa siempre.",
      sectionFavoritesEmpty: "Aún sin rutas favoritas.",
      sectionRoutesKicker: "Rutas compartidas",
      sectionRoutesOwn: "Rutas que tú pusiste en el tablón.",
      sectionRoutesOther: "Rutas que {name} puso en el tablón.",
      sectionRoutesEmpty: "Aún sin rutas compartidas.",
      sectionPhotosKicker: "Fotos",
      sectionPhotosOwn: "Momentos que subiste desde la bici.",
      sectionPhotosOther: "Momentos que {name} subió desde la bici.",
      sectionPhotosEmpty: "Aún sin fotos.",
      sectionJournalKicker: "Entradas del diario",
      sectionJournalOwn: "Notas que escribiste en el diario del colectivo.",
      sectionJournalOther: "Notas que {name} escribió en el diario del colectivo.",
      sectionJournalEmpty: "Aún sin entradas en el diario.",
      activityRoute: "Compartió una ruta",
      activityPhoto: "Subió una foto",
      activityPost: "Escribió en el diario",
      buddySharedSingle: "{count} grupo en común",
      buddySharedPlural: "{count} grupos en común"
    },
    profileEdit: {
      previewKicker: "Vista previa",
      previewHint: "Pega una URL directa de imagen arriba para ver tu avatar aquí.",
      previewHintWarn: "Esa URL no cargó — pega un enlace directo a JPG, PNG o webp.",
      legendIdentity: "Identidad",
      legendRidingStyle: "Estilo de ride",
      legendAbout: "Sobre ti",
      labelNeighborhood: "Colonia",
      labelAvatar: "URL del avatar",
      labelAvatarPlaceholder: "https://ejemplo.com/rider.jpg",
      labelPace: "Ritmo",
      labelBike: "Bici",
      labelBikePlaceholder: "Acero todoterreno con guardafangos",
      labelBio: "Bio del rider",
      labelBioPlaceholder:
        "Vueltas al puente antes del trabajo, rides al café los sábados, días de monte en otoño.",
      counter: "{count} / {max}",
      bioOverLimit: "La bio rebasa el límite de {max} caracteres.",
      saveButton: "Guardar perfil",
      saveBusy: "Guardando..."
    },
    metrics: {
      milesBiked: "Millas rodadas",
      ridesTaken: "Rides realizados",
      routesTaken: "Rutas recorridas",
      longestRide: "Ride más largo"
    },
    pace: {
      easy: "Suave",
      steady: "Constante",
      fast: "Rápido"
    },
    terrain: {
      "city streets": "Calles de ciudad",
      greenway: "Greenway",
      gravel: "Terracería",
      "mixed surface": "Superficie mixta"
    },
    units: {
      pace: "ritmo"
    },
    routeCard: {
      sharedBy: "Compartida por {name}",
      viewRoute: "Abrir pantalla de ride",
      editRoute: "Editar ruta",
      distance: "{miles}",
      terrain: "Terreno: {terrain}",
      start: "Inicio: {start}"
    },
    groups: {
      loading: "Cargando grupos...",
      pageTitle: "Organiza bandas recurrentes, fija rutas confiables y lanza rides desde un solo lugar.",
      pageLead:
        "Los grupos dan estructura más allá del feed compartido: cada uno tiene su propio roster, sus rutas guardadas y un flujo simple para unirse.",
      kicker: "Grupos del colectivo",
      createGroupName: "Nombre del grupo",
      createGroupNamePlaceholder: "Amaneceres del Río",
      createDescription: "Descripción",
      createDescriptionPlaceholder:
        "Para quién es el grupo, qué ritmo le gusta y qué rutas suele fijar.",
      createSubmit: "Crear grupo",
      createBusy: "Creando grupo...",
      countRiders: "{count} riders",
      pinnedRoutes: "{count} rutas fijadas",
      milesLogged: "{miles} registradas",
      startedBy: "Iniciado por",
      viewGroup: "Ver grupo",
      join: "Unirme",
      joining: "Uniéndome...",
      joinedSuccess: "Te uniste al grupo."
    },
    groupDetail: {
      kicker: "Detalle del grupo",
      loading: "Cargando grupo...",
      notFound: "Ese grupo no existe.",
      backToGroups: "Volver a grupos",
      statMembers: "Miembros",
      statPinned: "Rutas fijadas",
      statMiles: "Millas registradas",
      statFounder: "Fundador",
      alreadyMember: "Ya eres parte de este grupo.",
      joinGroup: "Unirme al grupo",
      joining: "Uniéndome...",
      pinLabel: "Fijar una ruta para el grupo",
      pinSubmit: "Fijar ruta",
      pinBusy: "Fijando...",
      pinSuccess: "Ruta fijada al grupo.",
      rosterKicker: "Roster",
      rosterTitle: "Los riders actuales en este grupo.",
      pinnedKicker: "Rutas fijadas",
      pinnedTitle: "Rutas que esta banda mantiene listas para el día de ride.",
      pinnedEmpty: "Aún no se han fijado rutas."
    },
    routeBuilder: {
      loadingBuilder: "Cargando creador de rutas...",
      loadingEditor: "Cargando editor de rutas...",
      notOnBoard: "Esa ruta no está en el tablón.",
      ownerOnly: "Solo puedes editar rutas que tú creaste.",
      backToBoard: "Volver al tablón",
      backToRide: "Volver a la pantalla de ride",
      kickerEditor: "Editor de ruta",
      kickerBuilder: "Creador de ruta",
      titleEditor: "Pule la ruta antes de que la abra el siguiente rider.",
      titleBuilder: "Haz la ruta fácil de leer antes de que alguien intente seguirla en la bici.",
      lead:
        "Las rutas guardadas conservan su geometría, y las del Greenway reciben una guía dedicada para que se vea de un vistazo dónde corre el corredor.",
      modeSketch: "Trazar ruta",
      modeRecord: "Grabar ride en vivo",
      guideHowKicker: "Cómo usarlo",
      guideSketchTitle: "Traza primero, luego guarda.",
      guideRecordTitle: "Graba la línea mientras rodas.",
      guideSketchLead:
        "Primero traza una línea limpia, luego guárdala para que la pantalla de ride tenga una ruta que seguir.",
      guideRecordLead:
        "Graba un ride en vivo cuando quieras que la ruta venga directamente de la calle o del sendero.",
      stepSketch1: "Toca la ruta en orden, de inicio a fin.",
      stepRecord1:
        "Da acceso a la ubicación y arranca la captura GPS en el verdadero punto de inicio.",
      stepGreenway:
        "Mantén visible la guía del Midtown Greenway para que tu línea siga el corredor.",
      stepName:
        "Pon nombre a la ruta y etiqueta el inicio para que los riders sepan de dónde salen.",
      stepSave:
        "Guarda la ruta, luego abre la pantalla de ride para seguirla en vivo o registrar el ride.",
      labelTitle: "Nombre de la ruta",
      labelTitlePlaceholder: "Vuelta de recuperación West River",
      labelStart: "Etiqueta del punto de inicio",
      labelStartPlaceholder: "Stone Arch Bridge",
      labelTerrain: "Terreno",
      labelNotes: "Notas del ride",
      labelNotesPlaceholder:
        "¿Qué debería saber otro rider antes de seguir esta ruta?",
      statLength: "Largo del trayecto",
      statRecorded: "Tiempo grabado",
      statPoints: "Puntos",
      undoPoint: "Deshacer último punto",
      clearSketch: "Limpiar trazo",
      startGps: "Iniciar captura GPS",
      stopGps: "Detener captura GPS",
      resetTrace: "Reiniciar trazo del ride",
      submitSave: "Guardar ruta al colectivo",
      submitSaving: "Guardando ruta...",
      submitEdit: "Guardar cambios",
      submitEditing: "Guardando cambios...",
      deleteRoute: "Eliminar ruta",
      deletingRoute: "Eliminando ruta...",
      mapNoteSketch:
        "Modo trazo: cada toque agrega un punto, así que usa vueltas, cruces y puntos claros de reagrupe.",
      mapNoteRecord:
        "Modo en vivo: los puntos GPS aparecen mientras se capturan, mantén la página abierta hasta terminar el ride.",
      gpsClickStart:
        "Toca el mapa para trazar una ruta o cambia a captura GPS en vivo.",
      gpsEditing: "Editando {title}. Actualiza la línea o las notas y guarda los cambios.",
      errorMinPoints: "Agrega al menos dos puntos a la ruta antes de guardarla.",
      routeSnapping: "Trazando el boceto por calles y senderos ciclistas...",
      routeSnapFailed: "El ruteo ciclista no estuvo disponible, se guardara la linea trazada.",
      routePreviewReady: "Vista previa lista con {provider}.",
      routePreviewProvider: "ruta ciclista",
      gpsSnapping: "Ajustando el GPS grabado a calles y senderos ciclistas...",
      gpsSnapFailed: "El ruteo ciclista no estuvo disponible, se guardará la línea GPS cruda.",
      gpsLoadedSuggestion: "{title} se cargó como punto de partida. Ajusta la línea o las notas y guarda tu versión.",
      gpsCleared: "Grabación limpiada. Reinicia la captura GPS cuando estés listo.",
      pathCleared: "Trazo limpiado. Toca el mapa para dibujar una nueva ruta.",
      gpsWaiting: "Esperando puntos GPS. Mantén esta página abierta mientras rodas.",
      gpsLive: "Captura GPS activa con puntos finos. Detén la grabación cuando termines la ruta.",
      sketchActive: "Modo trazo activo. Toca vueltas, puntos de reagrupe o curvas del sendero en el mapa.",
      recordActive: "Modo ride en vivo activo. Inicia la captura GPS cuando estés rodando y deja esta página abierta.",
      addressSearchPlaceholder: "Busca una dirección o lugar",
      addressSearchModeLabel: "Modo de inserción por dirección",
      addressSearchAppend: "Agregar",
      addressSearchReplace: "Reemplazar seleccionado",
      addressSearchReplaceHint: "Toca primero un punto en el mapa y luego busca para reemplazarlo.",
      addressSearchLoading: "Buscando...",
      addressSearchEmpty: "Sin coincidencias cercanas.",
      addressSearchError: "Falló la búsqueda. Intenta de nuevo.",
      addressAppended: "Se agregó {address} a la ruta.",
      addressReplaced: "Se reemplazó el punto seleccionado por {address}."
    },
    rideScreen: {
      kicker: "Pantalla de ride",
      loading: "Cargando la pantalla de ride...",
      notOnBoard: "Esa ruta no está en el tablón.",
      lead:
        "Sigue la línea guardada, observa tu posición en vivo y registra el ride al terminar.",
      editRoute: "Editar ruta",
      deleteRoute: "Eliminar ruta",
      deletingRoute: "Eliminando ruta...",
      cueKicker: "Indicación en vivo",
      cueStartLabel: "Inicio: {start}",
      cueTerrainLabel: "Terreno: {terrain}",
      cueDistanceFromLine: "Distancia a la línea: {miles}",
      cueRemaining: "Restan: {miles}",
      cueActiveLeg: "Tramo activo: {miles}",
      cueRoutingLoading: "Trazando calles...",
      cueRoutingFallback: "Línea guardada como respaldo",
      cueRoutingWith: "Ruteo con {provider}",
      cueStreetCues: "Indicaciones con nombre de calle",
      directionsShow: "Indicaciones",
      directionsHide: "Ocultar indicaciones",
      voiceOff: "Voz",
      voiceOn: "Voz activa",
      voiceStatusOff: "Guía por voz desactivada",
      voiceStatusOn: "Guía por voz activa. Las vueltas se anunciarán al acercarse.",
      voiceStatusWait: "La guía por voz espera al rastreo GPS.",
      voiceUnsupported: "Este navegador no soporta indicaciones habladas.",
      bearingModeLabel: "Modo de orientación del mapa",
      bearingRoute: "Ruta",
      bearingCompass: "Brújula",
      mapControlsLabel: "Controles del mapa",
      zoomIn: "Acercar",
      zoomOut: "Alejar",
      recenterMap: "GPS",
      compassToggleOff: "Brújula apagada",
      compassToggleOn: "Brújula activa",
      compassDenied: "Acceso al sensor bloqueado",
      statRouteLength: "Largo de la ruta",
      statElapsed: "Transcurrido",
      statDistanceFromLine: "Distancia a la línea",
      statTrail: "Tu trazo",
      controlsTitle: "Controles del ride en vivo",
      controlsBody:
        "Activa la guía GPS al salir del inicio guardado. Si solo quieres registrar el esfuerzo, puedes correr el temporizador sin ubicación en vivo.",
      pauseGps: "Pausar guía GPS",
      startGps: "Iniciar guía GPS",
      startWithout: "Iniciar ride sin GPS",
      reverseCourse: "Invertir ruta",
      forwardCourse: "Ruta normal",
      backToBoard: "Volver al tablón",
      supportNote:
        "La geolocalización funciona en localhost durante desarrollo. En producción se requiere HTTPS para que los navegadores compartan la ubicación en vivo.",
      completeRide: "Registrar ride terminado",
      completing: "Registrando ride...",
      pinnedByGroups: "Fijada por grupos",
      pinnedEmpty: "Ningún grupo ha fijado esta ruta aún.",
      suggestedTitle: "Próximos rides sugeridos",
      suggestedDescription:
        "Cuando termines este ride, encadena el siguiente sin volver al tablón en blanco.",
      headlineHeadToStart: "Dirígete al inicio",
      headlineReturnRoute: "Vuelve a la ruta",
      headlineSlightDrift: "Ligera desviación",
      headlineRouteCheck: "Revisa la ruta",
      headlineWaitingGps: "Esperando señal GPS",
      headlineGuidanceReady: "Guía lista",
      detailToStartFallback:
        "Primero llega al inicio guardado. El tramo hasta la meta comienza al alcanzarlo.",
      detailSlightDrift:
        "Estás un poco fuera de la línea guardada. Usa el mapa para regresar a la ruta antes de que crezca la separación.",
      detailRouteCheck:
        "Estás claramente fuera de la línea guardada. Pausa, mira el mapa y vuelve a la ruta resaltada.",
      detailReturn:
        "Estás a {miles} de la línea guardada. Vuelve hacia la ruta resaltada.",
      detailWaitingGps:
        "Tu ubicación aparecerá cuando el navegador la fije.",
      detailGuidanceReady:
        "Activa la guía GPS al estar en el inicio de la ruta, o usa el temporizador si solo quieres registrar el ride.",
      rideLoggedFeedback: "Ride registrado: {miles} en {duration}.",
      routeDeletedFeedback: "Ruta eliminada.",
      confirmDelete:
        "¿Eliminar \"{title}\"? Esto la quita del tablón y de los grupos donde estaba fijada.",
      geoUnsupported: "Este navegador no soporta geolocalización en vivo.",
      geoDenied:
        "Se denegó el acceso a la ubicación. Usa modo trazo o permite la geolocalización para este sitio.",
      geoFailed: "Falló la captura GPS en vivo. Intenta de nuevo o usa modo trazo.",
      trackDenied:
        "Se denegó el acceso a la ubicación. Permite la geolocalización para seguir la ruta en vivo.",
      trackFailed: "Falló el rastreo en vivo. Intenta de nuevo con mejor señal GPS.",
      saveSuccess: "Ruta guardada. Abre la pantalla de ride para seguirla en vivo.",
      saveSuccessProvider: "Ruta guardada con ruteo ciclista vía {provider}. Abre la pantalla de ride para seguirla en vivo.",
      saveSuccessRide: "Ruta guardada y se registró tu ride.",
      saveSuccessRideProvider: "Ruta guardada con ruteo ciclista vía {provider} y se registró tu ride.",
      saveUpdated: "Ruta actualizada.",
      saveUpdatedProvider: "Ruta actualizada con ruteo ciclista vía {provider}.",
      metaStart: "Inicio",
      metaTerrain: "Terreno",
      metaNotes: "Notas"
    },
    routeMap: {
      legendRoute: "Línea de ruta",
      legendTrail: "Tu trazo",
      legendGuide: "Guía del Greenway",
      legendYou: "Tú",
      badgeGreenway: "Línea Greenway",
      badgeMixed: "Superficie mixta",
      badgeCity: "Ruta de ciudad",
      markerStart: "Inicio",
      markerFinish: "Meta",
      markerRider: "Tú",
      summaryTotal: "{miles}",
      summaryStart: "Inicio: {start}"
    },
    directions: {
      kicker: "Vuelta por vuelta",
      title: "Indicaciones",
      loading: "Cargando indicaciones de calle.",
      idle: "Activa la guía GPS para ver el paso actual.",
      sectionToStart: "Hacia el inicio",
      sectionRoute: "Ruta hasta la meta",
      sectionSaved: "Línea guardada",
      hide: "Ocultar",
      steps: "{count} pasos",
      current: "Actual",
      stepSavedStart: "Inicia en {start}",
      stepSavedFollow: "Sigue la línea resaltada",
      stepSavedArrive: "Llega a la meta",
      detailContinue: "Sigue por la ruta.",
      detailVia: "Por {street}",
      detailFallback: "Comienza en el punto de inicio guardado.",
      detailSavedFollow:
        "Las indicaciones por calle aparecerán cuando esté disponible el ruteo.",
      detailSavedFinish: "Termina al final de la ruta guardada."
    },
    favorite: {
      add: "Guardar favorita",
      remove: "Guardada",
      busy: "Guardando..."
    },
    suggested: {
      labelBest: "Mejor primer ride",
      labelClassic: "Clásico de Mineápolis",
      labelLong: "Pull largo de entrenamiento",
      labelQuick: "Vuelta rápida",
      labelFavorite: "Favorita del colectivo",
      noteBest:
        "Distancia suave y forgiving con la guía del Greenway encimada en el mapa.",
      noteClassic:
        "Buen ride de ciudad cuando quieres puntos de referencia, puentes y una ruta fácil de leer.",
      noteLong:
        "Más distancia, menos vueltas repetidas, mejor opción cuando el grupo quiere un día más grande.",
      noteQuick:
        "Una opción corta cuando quieres una ruta fácil de cargar y seguir.",
      noteFavorite:
        "Compartida recientemente por el colectivo y lista para abrir en la pantalla de ride.",
      title: "Arranca desde una línea probada",
      description:
        "Usa una ruta del colectivo como plantilla en vez de trazar desde un mapa en blanco.",
      action: "Cargar al editor"
    }
  }
};

function getNested(obj, key) {
  return key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function interpolate(template, vars) {
  if (!template || !vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    return vars[name] !== undefined ? String(vars[name]) : match;
  });
}

function detectInitialLang() {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {
    // localStorage may be unavailable; fall through
  }
  return DEFAULT_LANG;
}

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota or disabled storage
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const fromCurrent = getNested(dictionaries[lang], key);
      const fromFallback = fromCurrent !== undefined ? fromCurrent : getNested(dictionaries[DEFAULT_LANG], key);
      if (fromFallback === undefined) return key;
      return interpolate(fromFallback, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export const SUPPORTED_LANGS = SUPPORTED;
