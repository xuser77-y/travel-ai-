# Travio — UML Diagrams

> PlantUML source for the four UML diagrams used in the PFE report. Each block can be pasted directly into the [PlantUML web editor](https://www.plantuml.com/plantuml/uml/), the official VS Code / Windsurf PlantUML extension, or StarUML (via **File → Import → PlantUML**).
>
> All diagrams are kept deliberately classic (no skinparam eye-candy), medium-sized, and framed as a **domain model** — no database-implementation details, so the jury never has to debate "why MongoDB vs. SQL". The same class diagram maps 1:1 to any relational, document, or graph datastore.

---

## 1. Use Case Diagram

Covers the three primary actors of the platform and the full feature surface: authentication, AI planning, live social layer, billing, and administration.

```plantuml
@startuml UseCaseDiagram
left to right direction
skinparam packageStyle rectangle

actor "Visitor"       as Visitor
actor "Registered User" as User
actor "Administrator"  as Admin

Admin   --|> User
User    --|> Visitor

rectangle "Travio Platform" {

  ' --- Authentication ---------------------------------------------------
  usecase "Sign up (Email + OTP)" as UC_Signup
  usecase "Log in (password)"     as UC_Login
  usecase "Log in with Google"    as UC_Google
  usecase "Verify email (OTP)"    as UC_Otp

  ' --- AI Planner -------------------------------------------------------
  usecase "Generate AI trip plan"      as UC_Plan
  usecase "Let AI choose destination"  as UC_PickDest
  usecase "Refine itinerary via chat"  as UC_Refine
  usecase "View itinerary"             as UC_View
  usecase "Delete trip"                as UC_DelTrip

  ' --- Social & Live layer ---------------------------------------------
  usecase "Post on Live Map"           as UC_Post
  usecase "View Live Map"              as UC_MapView
  usecase "Join Community Hub"         as UC_Join
  usecase "Send chat message"          as UC_Chat

  ' --- World Cup 2030 --------------------------------------------------
  usecase "Browse World Cup 2030"      as UC_WC

  ' --- Billing & profile -----------------------------------------------
  usecase "Subscribe to a plan"        as UC_Pay
  usecase "Print PDF receipt"          as UC_Receipt
  usecase "Manage profile & settings"  as UC_Settings
  usecase "Receive notifications"      as UC_Notif

  ' --- Admin console ---------------------------------------------------
  usecase "Manage users"               as UC_AdmUsers
  usecase "Moderate content"           as UC_AdmMod
  usecase "Edit AI prompts"            as UC_AdmPrompt
  usecase "Broadcast notifications"    as UC_AdmBroadcast
  usecase "Configure plans & pricing"  as UC_AdmPlans
  usecase "Monitor analytics & API"    as UC_AdmMetrics
}

' --- Visitor reach ------------------------------------------------------
Visitor --> UC_Signup
Visitor --> UC_Login
Visitor --> UC_Google
Visitor --> UC_MapView
Visitor --> UC_WC

' --- User reach ---------------------------------------------------------
User --> UC_Plan
User --> UC_PickDest
User --> UC_Refine
User --> UC_View
User --> UC_DelTrip
User --> UC_Post
User --> UC_Join
User --> UC_Chat
User --> UC_Pay
User --> UC_Receipt
User --> UC_Settings
User --> UC_Notif

' --- Admin reach --------------------------------------------------------
Admin --> UC_AdmUsers
Admin --> UC_AdmMod
Admin --> UC_AdmPrompt
Admin --> UC_AdmBroadcast
Admin --> UC_AdmPlans
Admin --> UC_AdmMetrics

' --- Relationships ------------------------------------------------------
UC_Signup .> UC_Otp          : <<include>>
UC_Plan   .> UC_PickDest     : <<extend>>
UC_Pay    .> UC_Receipt      : <<include>>
UC_Post   .> UC_MapView      : <<extend>>
@enduml
```

---

## 2. Class Diagram (domain model)

Pure-UML class view of the business entities. All types are standard (`String`, `Date`, `float`, `List<T>`), and associations use multiplicities — nothing leaks MongoDB, Mongoose, or SQL. This diagram can be defended as "the logical data model" regardless of the persistence engine.

```plantuml
@startuml ClassDiagram
skinparam classAttributeIconSize 0
hide circle

class User {
  - id : String
  - email : String
  - name : String
  - passwordHash : String
  - googleId : String
  - isEmailVerified : Boolean
  - isAdmin : Boolean
  - disabled : Boolean
  - plan : PlanTier
  - planExpiresAt : Date
  - freeTripsUsed : int
  - trialLimit : int
  - createdAt : Date
  + signUp(email, password) : void
  + verifyOtp(code) : Boolean
  + hasFeature(name) : Boolean
}

class Profile {
  - avatar : String
  - bio : String
  - preferredCurrency : String
  - interests : List<String>
}

enum PlanTier {
  FREE
  BASIC
  PRO
  PREMIUM
}

class Subscription {
  - id : String
  - plan : PlanTier
  - amount : float
  - currency : String
  - provider : String
  - periodStart : Date
  - periodEnd : Date
  - status : String
}

class Trip {
  - id : String
  - destinationName : String
  - latitude : float
  - longitude : float
  - startDate : Date
  - endDate : Date
  - travelers : String
  - style : String
  - totalBudget : float
  - currency : String
  - interests : List<String>
  - status : String
  - createdAt : Date
  + generate() : Trip
  + refine(message) : Trip
  + delete() : void
}

class Day {
  - dayNumber : int
  - date : Date
  - transportSuggestion : String
  - weatherRating : String
}

class Session {
  - time : String
}

class Activity {
  - name : String
  - category : String
  - description : String
  - cost : float
  - duration : String
  - latitude : float
  - longitude : float
  - isIndoor : Boolean
}

class ChatRoom {
  - id : String
  - name : String
  - destination : String
  - inviteCode : String
  - isGlobalDefault : Boolean
  - createdAt : Date
  + join(user) : void
  + leave(user) : void
  + postMessage(user, text) : Message
}

class Message {
  - id : String
  - text : String
  - timestamp : Date
}

class LivePost {
  - id : String
  - authorId : String
  - author : String
  - type : String
  - message : String
  - latitude : float
  - longitude : float
  - sentiment : String
  - upvotes : int
  - expiresAt : Date
  - createdAt : Date
}

class Notification {
  - id : String
  - title : String
  - message : String
  - link : String
  - type : String
  - expiresAt : Date
  - createdAt : Date
}

class AiPrompt {
  - key : String
  - systemPrompt : String
  - userTemplate : String
  - updatedAt : Date
  + render(context) : String
}

' --- Relationships ------------------------------------------------------
User "1" *-- "1" Profile                     : has
User "1" o-- "*" Subscription                : history
User "1" -- "1" PlanTier                     : current >
User "1" -- "*" Trip                         : owns >
User "*" -- "*" ChatRoom                     : member of >
User "1" -- "*" Notification                 : receives >

Trip "1" *-- "*" Day                         : itinerary
Day  "1" *-- "*" Session                     : sessions
Session "1" *-- "1" Activity                 : activity
Trip "0..1" -- "1" ChatRoom                  : linked hub

ChatRoom "1" *-- "*" Message                 : messages
Message  "*" -- "1" User                     : sent by >

LivePost     "*" ..> "0..1" User             : authored by
Notification "*" ..> "1" User                : created by admin
@enduml
```

---

## 3. Sequence Diagram — "Generate AI trip plan"

The flagship workflow. Shows the full journey from a browser click to a persisted itinerary: authentication check, plan-quota gate, parallel external lookups (weather / photo / POI), LLM generation, persistence, and the HTTP response.

```plantuml
@startuml SequenceDiagram
actor User as U
participant "Planner UI\n(React)" as FE
participant "Express Router\n/api/trips" as API
participant "planGate\n(middleware)" as Gate
participant "plannerOrchestrator" as Orch
participant "weatherService" as Weather
participant "photoService" as Photo
participant "poiService" as POI
participant "aiService\n(Groq LLM)" as AI
database "Database" as DB

U  -> FE : Submits 7-step form
FE -> API : POST /api/trips/generate\n(JWT, form data)

API -> Gate : requireAuth + requireTripQuota
Gate -> DB  : load user, check plan & trialLimit
Gate --> API : OK

API -> Orch : orchestrate(tripData)

par Parallel fetch
  Orch -> Weather : forecast(destination)
  Weather --> Orch : daily summary
and
  Orch -> Photo   : getDestinationPhoto()
  Photo --> Orch  : image URL (or fallback)
and
  Orch -> POI     : overpass(destination)
  POI --> Orch    : nearby POIs
end

Orch -> AI : generateItinerary(ctx)
AI --> Orch : itinerary JSON

Orch -> DB : save Trip + create/link ChatRoom
DB --> Orch : saved Trip with _id

Orch --> API : Trip
API -> DB   : user.freeTripsUsed++
API --> FE  : 200 OK { trip }
FE --> U    : Navigates to /trip/:id
@enduml
```

---

## 4. Activity Diagram — End-to-end user journey

From landing to a saved trip, covering the quota/upgrade branch and the refine loop.

```plantuml
@startuml ActivityDiagram
start

:Open Travio landing;

if (Has account?) then (no)
  :Sign up with email;
  :Receive OTP by email;
  :Verify OTP;
else (yes)
  :Log in (email/password or Google);
endif

:Land on Dashboard;

:Start AI Planner\n(7-step form);

if (Manual destination?) then (yes)
  :Search city\n(Photon / Nominatim);
else (no)
  :Describe dream trip;
  :LLM suggests city;
  :Geocode suggestion;
endif

:Fill dates, travelers, budget,\nstyle, interests, dietary;

:Submit form;

if (Plan quota OK?) then (yes)
  :Parallel fetch\nweather / photo / POIs;
  :Call Groq LLM;
  :Persist Trip in database;
  :Redirect to Trip Results page;

  repeat
    :View itinerary, weather,\nhotels, flights;
    if (Modify trip?) then (yes)
      :Send message to AI chat;
      :Backend validates edit;
      if (LLM produced a real edit?) then (yes)
        :Update itinerary\n& persist;
      else (no)
        :Show "rephrase" hint;
      endif
    else (no)
    endif
  repeat while (Continue editing?) is (yes)
  -> no;

else (no)
  :Show Upgrade screen;
  if (User upgrades?) then (yes)
    :Process checkout\n(mock or Stripe);
    :Activate plan\n+ subscriptionHistory;
    :Resume planning;
  else (no)
    stop
  endif
endif

:Optionally\nshare trip hub,\npost on Live Map,\nreceive notifications;

stop
@enduml
```

---

## How to render

**VS Code / Windsurf** — install the *PlantUML* extension (jebbs.plantuml), open this file, and preview with `Alt+D`.

**Online** — paste any block (between `@startuml` and `@enduml`) at `https://www.plantuml.com/plantuml/uml/`.

**StarUML** — `File → Import → PlantUML` and point at the extracted block, or use the PlantUML extension from the StarUML Extension Manager.

Each diagram exports cleanly to **PNG** or **SVG** at any resolution — recommended: SVG for the report, PNG 2× for the slide deck.
