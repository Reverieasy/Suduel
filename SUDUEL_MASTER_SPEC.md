SUDUEL — Master Project Specification for Codex
Version: 1.0
Project: SUDUEL
Type: Full-stack multiplayer browser game
Platform: Responsive web application
Development team: Two developers
Tagline: Solve. Attack. Outplay.

1. PROJECT OVERVIEW
We are developing SUDUEL, a real-time competitive Sudoku battle game inspired by the multiplayer mechanics of Tetris Battle.
SUDUEL transforms traditional Sudoku into a modern, fast-paced puzzle competition.
Two players compete in real time, solving identical Sudoku puzzles while monitoring each other's progress. Completing rows, columns, and boxes generates attack energy that can be spent on temporary disruptions against the opponent.
The gameplay should feel competitive, strategic, responsive, and visually satisfying without sacrificing the logical integrity of Sudoku.
The website will eventually include:
Real-time multiplayer Sudoku battles
Classic Race and Battle Mode
Private rooms and public matchmaking
Skill-based rankings and seasonal leaderboards
Player profiles and profile pictures
Unlockable and equippable titles
Customizable Sudoku board skins
Achievements, levels, and XP
Match history and statistics
Friends and social interactions
Community activity feed
Cosmetic shop and optional purchases
Core philosophy: SUDUEL is a competitive puzzle game first and a social gaming platform second.
The quality, fairness, and responsiveness of the actual game must always take priority.

2. APPROVED DESIGN DIRECTION
We have already chosen the visual direction for the website. Maintain this design throughout development.
Visual Style
Minimalist arcade-game aesthetic inspired by the simplicity of classic Tetris interfaces
Dark navy background
Flat, clean components
Rectangular cards with subtle rounded corners
Thin borders and restrained shadows
Bold, readable typography
Simple geometric icons
Clean, sharp Sudoku grids
Limited animation and minimal glow
Color Palette
Purpose
Color
Main background
#0B1422
Secondary background
#111F30
Card background
#162538
Primary blue
#2196F3
Opponent red
#F04452
Accent yellow
#FFCC33
Success green
#2EC78A
Primary text
#F5F7FA
Secondary text
#94A3B8
Borders
#2B4057

Use these as initial design tokens, not rigid restrictions for every UI element.
Typography
Use Inter or another clean sans-serif for interface text.
An optional block-style display font can be used sparingly for headings, logos, and victory announcements.
UI Principles
Keep Sudoku numbers exceptionally readable.
Preserve sufficient contrast between original clues and player-entered values.
Blue represents the local player.
Red represents the opponent.
Yellow highlights energy, warnings, and important rewards.
Avoid unnecessary gradients, neon effects, and distracting animations.
Never use anime characters, anime avatars, or anime-inspired illustrations as part of the default interface.
Skins must not affect gameplay information or competitiveness.
Support desktop and mobile screens.
Maintain consistency across the entire website.
Gameplay Screen
On desktop:
Player 1 board on the left
Player 2 board on the right
Match timer in the upper center
Player information above the boards
Progress bars and scores
Number input controls below the local board
Attack toolbar in the bottom section
Clear notification when an attack is received or sent
On mobile:
Local player's board receives the majority of available space
Opponent shown through a compact progress panel and expandable board preview
Number input controls stay accessible
Attack buttons remain reachable without obscuring the puzzle
The interface must prioritize gameplay over decorative elements.

3. TECHNOLOGY STACK
Use this stack unless a technical limitation requires a justified change.
Frontend
React
TypeScript
Vite
Tailwind CSS
shadcn/ui for general application components
Lucide React for icons
Zustand for local game and interface state
React Router for navigation
Motion for React for lightweight transitions and animations
Build the Sudoku board with React components and CSS Grid. A canvas rendering engine is unnecessary for the first version.
Backend
Use Supabase for:
PostgreSQL database
Authentication
Realtime communication
Storage
Edge Functions
Server-side database operations
Use Supabase Realtime Broadcast for match event delivery and Presence for connected-player status.
Use PostgreSQL RPC functions for atomic, validated state transitions where appropriate.
Use Edge Functions for trusted server operations that do not fit well inside a database function.
Testing
Vitest for unit tests
React Testing Library for component tests
Playwright for end-to-end testing
ESLint and TypeScript strict mode for code quality
Deployment
Vercel for frontend hosting
Supabase for backend hosting
GitHub for version control
GitHub Actions for continuous integration, when needed
Additional Tools
Figma for UI/UX design
npm as the initial package manager
Zod for validating client input and shared request schemas
Avoid unnecessary microservices, heavyweight game engines, and paid AI services.

4. RECOMMENDED SYSTEM ARCHITECTURE
Use a modular architecture that separates the presentation layer from the Sudoku engine, multiplayer rules, and data services.
                    SUDUEL
                       |
                React Web Client
                       |
       +---------------+---------------+
       |               |               |
     Pages         Game Engine      UI State
       |               |               |
       +---------------+---------------+
                       |
                 API Services
                       |
                Supabase Backend
                       |
          +------------+------------+
          |            |            |
      PostgreSQL    Realtime      Storage
          |
     Validated RPC
     and Edge Functions
          |
    Authoritative Match State
The client is responsible for displaying the game and submitting player actions.
The server is responsible for validating moves, managing authoritative match state, awarding attack energy, applying attacks, and confirming match outcomes.
Never trust the client to submit an arbitrary score, winner, rank change, energy balance, or completed puzzle.
Game Event Flow
Player selects a Sudoku cell and enters a number.
The client displays a pending input state.
The client submits the move with its match ID and unique action ID.
The server verifies the player's identity and participation in the match.
The server validates the cell, number, match status, and relevant rules.
If valid, the server updates authoritative match state atomically.
The server calculates completed rows, columns, boxes, and energy rewards.
The server broadcasts the accepted state change to both participants.
Both clients update their board and animations.
The server determines whether the match has ended.
Include match-state revision numbers and action IDs to handle duplicates, delayed events, and reconnects.
For MVP, consistency and correctness are more important than optimizing for extremely high move frequency.

5. GAME MODES
5.1 Practice Mode
Single-player Sudoku.
Features:
Choose difficulty
Fill cells
Pencil marks
Erase numbers
Restart puzzle
Completion timer
Optional hints
Practice Mode does not affect competitive rank.
5.2 Classic Race
Two players receive identical Sudoku puzzles.
Rules:
No attacks
Same starting clues
Same match timer
Live progress tracking
First player to complete the puzzle correctly wins
The opponent's board can display cell completion and active-cell location, but not the actual entered numbers.
5.3 Battle Mode
Main competitive mode.
Both players solve identical puzzles.
Completing a row, column, or box generates attack energy.
Players can spend their energy to send temporary attacks.
The first player to correctly complete the puzzle wins.
5.4 Private Match
Players can create invitation-based rooms.
Features:
Shareable room link
Room code
Create or join room
Ready status
Host-controlled match settings
Classic or Battle rules
Rematch
Leave room
Support 1v1 first.
Do not build 2v2 or four-player matches in the initial release.
5.5 Ranked Match
Future competitive mode.
Features:
Automatic opponent matching
Skill-based rating
Seasonal leaderboard
Win/loss history
Rank promotion and demotion
Disconnect handling
Anti-abuse safeguards
Ranked mode should only be enabled once server validation and match reliability have been tested thoroughly.

6. SUDOKU ENGINE
Build a pure TypeScript Sudoku engine independent of React.
It must support:
Puzzle generation or selection from verified puzzles
Solution validation
Puzzle difficulty metadata
Cell validation
Row validation
Column validation
Box validation
Completion detection
Conflict detection
Move history
Pencil marks as local player annotations
Initial clue protection
Supported Sizes
Start with:
9×9 Sudoku
Digits 1–9
Nine rows
Nine columns
Nine 3×3 boxes
Optional faster mode:
6×6 Sudoku
Digits 1–6
Six rows
Six columns
Six 2×3 boxes
Do not implement nonstandard sizes such as 4×4 or 16×16 until the main system is working.
Puzzle Fairness
Players must receive the same initial puzzle with identical starting positions.
Use puzzles validated to have exactly one solution.
Choose suitable difficulty levels for competitive time limits.
Do not allow a client to submit its own puzzle or solution.
Store puzzle solution data securely. Clients receive the puzzle clues, not a precomputed answer key.
Note that Sudoku answers can still be derived using external solvers. Ranked anti-cheat will require additional detection and competitive safeguards.

7. CORE MATCH RULES
Initial rules to be tested and balanced:
Mechanic
Proposed Rule
Players
1v1
Starting puzzle
Identical
Default format
9×9
Fast format
6×6
Match duration
5 minutes
Correct placement
Adds progress
Invalid number
Rejected and may count as a mistake
Correctly completed row
+1 energy
Correctly completed column
+1 energy
Correctly completed box
+2 energy
Multiple units completed simultaneously
+1 combo energy
Energy limit
5
Primary win condition
First verified full completion

Each row, column, and box should award energy only once per player per match.
Erasing and re-entering numbers must not regenerate energy.
All mistakes and completion events must be calculated from validated server state.
Time Expiration
If neither player completes the puzzle before the timer ends:
Compare correct player-entered cells.
Compare number of mistakes.
Compare the timestamp at which each player first reached their final correct-cell total.
If still identical, declare a draw.
The tie-breaking policy should be consistent, transparent, and implemented server-side.
Scoring
Use separate concepts for:
Match progress
Correct placements
Completed units
Attack energy
Display score
Competitive rating
Competitive rating is updated only after a verified match result.
Do not let cosmetic purchases affect scoring.

8. ATTACK SYSTEM
This is SUDUEL's main differentiating feature.
Players gain energy through correctly completed Sudoku units and can spend that energy on attacks.
Initial Attacks
Fog
Cost: 1 energy
Effect: Temporarily covers a selected 3×3 section of the opponent's board for 3 seconds.
The covered cells remain unchanged, and the puzzle stays valid.
Freeze
Cost: 2 energy
Effect: Temporarily prevents number entry for 1.5 seconds.
Scramble
Cost: 2 energy
Effect: Rearranges the opponent's on-screen number input buttons for 5 seconds.
The number meanings remain unchanged.
Shield
Cost: 2 energy
Effect: Cancels the next eligible incoming attack.
Attack Rules
Attacks cannot change the Sudoku solution.
Attacks cannot permanently delete correct values.
Attacks cannot change the original clues.
Attacks cannot alter competitive ratings directly.
Energy must be validated by the server.
Attack durations must be controlled by authoritative timestamps.
Attack cooldowns and overlapping effects require clear rules.
Add temporary immunity after disruptive effects if testing shows repeated attacks are frustrating.
Shield and counters must not create infinite loops.
Attack Feedback
Use lightweight CSS and Motion animations:
Brief screen shake
Cell overlay
Attack notification
Energy consumption animation
Completion highlight
Small combo popup
Avoid excessive flashes, persistent full-screen obstruction, or effects that make the game inaccessible.
Include reduced-motion settings.
For the first alpha, implement only Fog and Scramble.
Add Freeze and Shield after playtesting.

9. REAL-TIME MULTIPLAYER
Use Supabase Realtime.
Required Features
Private match channels
Live player connection status
Ready-state synchronization
Synchronized match start
Server-controlled match timer
Player input synchronization
Opponent progress synchronization
Attack delivery
Disconnect detection
Reconnection
Result synchronization
Rematch state
Supabase Realtime Strategy
Use:
Broadcast: Accepted moves, progress updates, attacks, match events.
Presence: Players joining, leaving, and maintaining connection status.
PostgreSQL: Durable match state, verified game results, rewards, and player statistics.
Do not use Presence to broadcast every cursor movement or number entered.
Opponent Visibility
The opponent panel displays:
Username
Profile picture
Equipped title
Rank
Puzzle progress
Completed rows, columns, and boxes
Current cell focus, optionally
Attack effects
Match score
In competitive modes, do not reveal the opponent's actual entered numbers before the match concludes.
This preserves the live spectator feeling while preventing easy copying.
Match Reliability
Implement:
Action deduplication
Server timestamps
Idempotent completion processing
Reconnect state recovery
Disconnect grace periods
Protection from simultaneous winner submissions
Cancelled and abandoned match states
Prevent unauthorized users from controlling another player's game
A reconnecting player must be able to restore their accepted moves and active attack effects from server state.

10. PLAYER ACCOUNTS AND PROFILES
Use Supabase Auth.
Initial login methods:
Email and password
Optional Google sign-in later
Guest practice without an account
Require an authenticated account for ranked matches, persistent progression, inventory, and community participation.
Public Player Profile
Unique username
Display name
Profile picture
Biography
Equipped title
Current rank
Player level
XP progress
Total matches
Wins and losses
Win rate
Match history
Unlocked achievements
Equipped board skin
Profile cosmetics
Do not expose email addresses or other private authentication data.
Profile Pictures
Allow image upload, validation, size limits, and safe file formats.
Players should also have default geometric avatar options.

11. LEVELS, XP, AND ACHIEVEMENTS
SUDUEL should have two separate progression systems.
Player Level
Represents participation and experience.
XP earned through:
Finishing matches
Winning matches
Completing daily challenges
Unlocking achievements
Competitive Rank
Represents player skill.
Use a server-controlled rating system such as Glicko-2.
Rank changes must depend on verified competitive results.
Proposed tiers:
Bronze
Silver
Gold
Platinum
Diamond
Master
Legend
Tier boundaries and matchmaking rules should be configurable.
Achievements
Examples:
First Victory
10 Matches Completed
10-Win Milestone
Perfect Puzzle
No Mistakes
Combo Specialist
100 Rows Completed
100 Boxes Completed
First Ranked Victory
Achievements may unlock player titles, board skins, or profile customization.

12. PLAYER TITLES
Create a title system where players can unlock and equip one title beneath their username.
Examples:
Rookie Solver
Grid Apprentice
Number Hunter
Perfect Solver
Combo King
Puzzle Veteran
Grid Master
Sudoku Legend
Each title has:
Unique ID
Display text
Description
Unlock condition
Rarity
Availability
Optional cosmetic styling
Titles are cosmetic and must not influence matchmaking or gameplay.

13. BOARD SKINS AND CUSTOMIZATION
Create a customization page named Locker.
Players can equip:
Sudoku board skin
Number style
Cell highlight style
Profile border
Equipped title
Avatar
Attack animation
Victory animation
Initial Board Skins
Classic — dark navy and blue
Carbon — dark charcoal
Retro — pixel-inspired arcade design
Sakura — soft pink
Mint — green minimalist
Solar — yellow and navy
Skins must use a shared Sudoku component with design tokens.
Do not create separate game logic for different skins.
Skin Rules
No competitive advantages
No hidden information
Sufficient text contrast
Original clues always identifiable
Player input always distinguishable
Attack indicators remain visible
Optional reduced-motion support
Some skins will be free, some unlocked through achievements, and others eventually purchased.

14. LEADERBOARDS AND RANKINGS
Create a leaderboard page with:
Global rankings
Seasonal rankings
Friends leaderboard
Weekly wins
Highest rating
Win streaks
Each leaderboard entry should show:
Position
Avatar
Username
Equipped title
Rank
Rating
Wins
Leaderboard queries should be paginated and properly indexed.
Implement rank history so players can track progression.
The ranking system must use verified match results only.
Prevent duplicate rating awards from replayed or repeated completion requests.

15. COMMUNITY SYSTEM
Build a social community inside SUDUEL.
Community Feed
Players can eventually:
Share achievements
Share match results
Publish short posts
React to posts
Comment on posts
View other players' profiles
Follow or befriend players
Report inappropriate content
Suggested Feed Categories
All Posts
Achievements
Match Highlights
Announcements
Community Challenges
Initial Community Release
Start with automatic posts for major achievements and match milestones.
Add user-created posts, comments, and uploads in a later release.
Moderation
Include:
Reporting
Blocking
Rate limiting
Basic spam protection
Content visibility controls
Moderator permissions
Admin review queue
Post and comment removal
User suspension
Account deletion handling
Never allow the community system to launch publicly without basic moderation and abuse protections.

16. FRIENDS AND SOCIAL FEATURES
Future features:
Send friend request
Accept or reject friend request
View friends list
See online status when permitted
Invite friends to matches
View friend rankings
Visit public profiles
Block users
Do not build private messaging initially.
Players can communicate using existing external messaging applications while playing private matches.

17. COSMETIC SHOP AND MONETIZATION
SUDUEL is free-to-play.
All players must have access to core competitive gameplay without paying.
Possible paid items:
Premium board skins
Profile frames
Victory animations
Attack visual effects
Cosmetic bundles
Supporter packs
Store Architecture
Build an inventory and entitlement system first.
The shop should support:
Item catalog
Item ownership
Purchase history
Equipped cosmetics
Unavailable items
Optional seasonal collections
Do not integrate real payments in the initial MVP.
When monetization is ready, evaluate suitable payment providers for Philippine operations and confirm their technical, legal, and commercial requirements.
Purchases must be confirmed through trusted server-side payment verification.
A client must never grant itself premium items.
No paid gameplay boosts, extra energy, stronger attacks, or competitive advantages.

18. WEBSITE ROUTES
Suggested route structure:
/
  Landing page

/play
  Mode selection

/practice
  Solo Sudoku

/lobby/:roomCode
  Private room lobby

/match/:matchId
  Live battle arena

/results/:matchId
  Match results

/profile/:username
  Public player profile

/profile/edit
  Edit profile

/locker
  Skins and equipment

/leaderboard
  Rankings

/ranked
  Ranked matchmaking

/community
  Community feed

/community/post/:postId
  Individual post

/friends
  Friends system

/shop
  Cosmetic shop

/settings
  User settings

/auth
  Login and registration

/admin
  Restricted administration panel
Implement routes according to their development phase.
Do not expose incomplete production features as fully working pages.

19. DATABASE DESIGN
Use PostgreSQL through Supabase.
Design related tables with proper primary keys, foreign keys, constraints, indexes, and timestamps.
Accounts and Player Data
profiles
player_stats
player_rankings
player_rank_history
player_settings
Game Data
puzzles
game_rooms
room_members
matches
match_players
match_moves
match_events
match_results
Progression
seasons
achievements
player_achievements
titles
player_titles
Cosmetics
cosmetics
player_inventory
player_equipment
Social Features
friendships
community_posts
community_comments
post_reactions
user_blocks
content_reports
Commerce
shop_products
purchases
purchase_items
Important Data Design Rules
Use UUID identifiers where appropriate.
Store created and updated timestamps.
Create indexes for active matches, ranking queries, usernames, and feeds.
Keep authentication data separate from public profiles.
Use server-controlled rank and inventory updates.
Store match outcomes only once.
Prevent duplicate awards through database constraints and idempotency.
Retain only the event detail needed for replay, investigation, or analytics.
Plan retention and cleanup for old match events and inactive rooms.
Apply Row Level Security to every exposed table.
Use database migrations rather than manually changing production schema.
Do not create all future database tables immediately. Build the full schema incrementally alongside the relevant feature phases.

20. SECURITY AND ANTI-CHEAT
Security matters because SUDUEL is a competitive multiplayer game.
Requirements
Authenticated access for ranked play
Authorized private room membership
Server-side move validation
Server-side attack validation
Server-side rank calculations
Protected match results
RLS policies
Secure storage permissions
Input validation
Rate limiting
Audit logs for important state transitions
Protection against duplicate requests
Secure service credentials
No hardcoded secrets
No privileged Supabase keys in the frontend
Anti-Cheat Considerations
Detect impossible completion patterns.
Track unusual move timings.
Detect automated request flooding.
Restrict simultaneous ranked matches.
Validate submitted actions against authoritative state.
Use match event history for investigation.
No browser-based Sudoku game can completely prevent external solver assistance.
The goal is to reduce abuse, protect ranking integrity, and identify suspicious patterns without punishing legitimate skilled players unfairly.

21. ACCESSIBILITY AND PERFORMANCE
The website must be lightweight and responsive.
Performance
Avoid unnecessarily large UI packages.
Lazy-load secondary pages.
Optimize profile images.
Minimize unnecessary game-board rerenders.
Avoid excessive animation.
Limit database requests.
Use efficient realtime events.
Test with lower-end mobile devices.
Accessibility
Keyboard support for Sudoku
Accessible button labels
Sufficient color contrast
Color-blind-friendly status indicators
Reduced-motion preference
Adjustable sound effects
Visible focus states
Touch-friendly number input
Clear error messages
Desktop Controls
Mouse selects cell.
Number keys enter values.
Arrow keys navigate cells.
Backspace/Delete erases editable cells.
Escape closes overlays.
Optional keyboard shortcuts for notes.
Mobile players use an on-screen number pad.

22. PROJECT FOLDER STRUCTURE
Recommended layout:
suduel/
|
|-- public/
|   |-- assets/
|   |-- icons/
|   |-- sounds/
|
|-- src/
|   |-- app/
|   |   |-- router/
|   |   |-- providers/
|   |
|   |-- components/
|   |   |-- ui/
|   |   |-- layout/
|   |
|   |-- features/
|   |   |-- auth/
|   |   |-- sudoku/
|   |   |-- matches/
|   |   |-- attacks/
|   |   |-- profiles/
|   |   |-- progression/
|   |   |-- rankings/
|   |   |-- locker/
|   |   |-- community/
|   |   |-- shop/
|   |
|   |-- game/
|   |   |-- engine/
|   |   |-- rules/
|   |   |-- validators/
|   |   |-- types/
|   |
|   |-- hooks/
|   |-- services/
|   |-- stores/
|   |-- styles/
|   |-- lib/
|   |-- tests/
|   |-- main.tsx
|
|-- supabase/
|   |-- migrations/
|   |-- functions/
|   |-- seed.sql
|
|-- docs/
|   |-- architecture.md
|   |-- design-system.md
|   |-- game-rules.md
|   |-- database.md
|   |-- roadmap.md
|
|-- .env.example
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- README.md
Each feature directory should contain its own UI, hooks, services, types, and tests as necessary.
Keep game-rule logic outside presentational components.
Avoid premature abstractions and unnecessary architectural complexity.

23. DEVELOPMENT PHASES
PHASE 1 — Foundation
Goal: Establish the project and produce a polished, playable local Sudoku experience.
Build:
React project setup
Tailwind configuration
Design system
Website navigation
Landing page
Mode selection screen
Authentication
Player profile foundation
Sudoku engine
Practice Mode
Responsive Sudoku board
Number input and keyboard controls
Unit tests
Completion criteria: A user can open the site and solve a valid Sudoku puzzle from start to finish.
PHASE 2 — Multiplayer Core
Goal: Create reliable real-time 1v1 matches.
Build:
Private room creation
Shareable invite codes
Join and ready states
Same puzzle for both players
Authoritative match lifecycle
Real-time move synchronization
Opponent board view
Match timer
Correct completion validation
Match results
Rematch
Reconnection handling
Completion criteria: Two players on separate devices can finish an entire synchronized match without losing state.
PHASE 3 — Battle System
Goal: Introduce strategic attacks.
Build:
Energy generation
Completed-row detection
Completed-column detection
Completed-box detection
Attack buttons
Fog
Scramble
Attack notifications
Energy indicators
Combo detection
Cooldowns and effect expiration
Then test Freeze and Shield.
Completion criteria: Both players can earn energy and exchange valid attacks without corrupting the Sudoku board.
PHASE 4 — Player Identity and Progression
Build:
Profiles
Avatar uploads
Match statistics
Player levels
XP
Achievements
Unlockable titles
Basic board skins
Locker interface
Completion criteria: Players can maintain a persistent profile and customize their appearance.
PHASE 5 — Competitive Platform
Build:
Matchmaking
Competitive skill ratings
Rank tiers
Ranked match validation
Seasonal leaderboards
Match history
Rank history
Competitive abuse monitoring
Completion criteria: Ranked results produce consistent server-controlled rating changes, and players appear on appropriate leaderboards.
PHASE 6 — Community and Monetization
Build:
Friends system
Achievement feed
Community posts
Reactions and comments
Reporting and moderation
Cosmetic catalog
Shop interface
Secure purchase verification
Premium inventory entitlements
Completion criteria: Social content is appropriately moderated, and purchased cosmetics can be securely granted and equipped.

24. TESTING REQUIREMENTS
Every phase must include functional testing.
Sudoku Tests
Valid puzzle completion
Invalid number rejection
Clue protection
Correct row completion
Correct column completion
Correct box completion
Unique solution verification
Energy awarded once per completed unit
Multiplayer Tests
Two users joining the same room
Duplicate join attempts
Simultaneous actions
Unauthorized moves
Connection loss
Reconnect
Player leaving
Timer expiration
Simultaneous near-completion
Duplicate winner event
Rematch after completion
Attack Tests
Insufficient energy
Correct energy deduction
Effect expiration
Attack targeting
Repeated attacks
Shield interaction
Attack during match completion
Attacks during disconnects
Security Tests
Unauthorized profile updates
Unauthorized match access
Forged scoring requests
Forged inventory ownership
Unauthorized ranked changes
RLS isolation
Excessive request rates
Do not mark a development phase complete unless its core features have passed relevant tests.

25. PRODUCT CONSTRAINTS
This project is being built by a two-person team.
Follow these rules:
Prioritize low-cost technologies.
Avoid paid services unless necessary.
Focus on shipping a reliable MVP.
Implement features incrementally.
Maintain the approved visual design.
Avoid unnecessary dependencies.
Prefer maintainable code over complicated architecture.
Never sacrifice competitive fairness for flashy effects.
Keep all cosmetic purchases noncompetitive.
Design for future scaling without overengineering the initial system.

26. INSTRUCTIONS FOR CODEX
You are the lead development assistant for SUDUEL.
Treat this specification as the project's master blueprint.
Before implementation:
Inspect the existing repository if one is available.
Identify whether the project is empty or already initialized.
Review the current architecture and dependencies.
Identify reusable code.
Create a phase-by-phase development plan.
Recommend only necessary changes.
Establish the design tokens and architecture.
Explain all necessary environment variables without requesting or exposing secret values.
Important:
Do not attempt to implement all six phases in one operation.
Begin with Phase 1 only.
Create a functional, polished foundation and working Sudoku engine.
Maintain the approved Tetris-inspired minimalist UI.
For every implementation step:
Explain what will be built.
Implement working code.
Include appropriate tests.
Verify build and type checking.
Identify any incomplete integrations.
Summarize completed work.
Recommend the next logical development task.
Do not create fake backend functionality and present it as real.
Do not use placeholder matchmaking, fake rankings, or simulated online players without clearly labeling them as demonstrations.
If Supabase has not been connected, create an appropriate local development experience and clearly distinguish local-only features from actual multiplayer functionality.
Preserve the project structure and avoid unnecessary rewrites.

27. FIRST DEVELOPMENT TASK
Start by setting up the frontend foundation for SUDUEL.
The initial deliverables are:
Initialize the React + TypeScript + Vite application.
Configure Tailwind CSS and the chosen design tokens.
Create the main website layout.
Build the minimalist landing page.
Build the game mode selection screen.
Implement the reusable Sudoku board component.
Build the pure TypeScript Sudoku engine.
Create a playable local Practice Mode.
Add responsive layouts for desktop and mobile.
Include validation, unit tests, and build verification.
Prepare the Supabase integration architecture without implementing multiplayer prematurely.
Document completed features and next steps.
Do not start ranked matchmaking, community features, the cosmetic shop, or real-time multiplayer during the initial task.
The first milestone is a functional local Sudoku game with the approved SUDUEL visual identity.
Once that milestone is tested and approved, proceed to multiplayer development.

FINAL PRODUCT VISION
SUDUEL is not intended to be another ordinary Sudoku website.
It is a modern multiplayer puzzle-battle platform combining logical problem-solving, competitive strategy, real-time opponent interaction, personalized cosmetics, rankings, and community engagement.
The game should feel like an accessible competitive arcade experience while maintaining the intellectual challenge of Sudoku.
SUDUEL — Solve. Attack. Outplay.

