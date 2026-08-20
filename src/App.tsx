import {useEffect} from 'react'
import {Navigate, Route, Routes} from 'react-router-dom'
import CallLayer from './context/CallLayer'
import Landing from './routes/Landing'
import SignIn from './routes/SignIn'
import Onboarding from './routes/Onboarding'
import Dashboard from './routes/Dashboard'
import CefrTest from './routes/CefrTest'
import Learn from './routes/Learn'
import Reading from './routes/Reading'
import ReadingPracticeSession from './routes/ReadingPracticeSession'
import ReadingExam from './routes/ReadingExam'
import ReadingResults from './routes/ReadingResults'
import ReadingMyResults from './routes/ReadingMyResults'
import ReadingReader from './routes/ReadingReader'
import Exercises from './routes/Exercises'
import ExerciseSession from './routes/ExerciseSession'
import AdminCefrGeneration from './routes/AdminCefrGeneration'
import AdminPanel from './routes/AdminPanel'
import Writing from './routes/Writing'
import WritingMyResults from './routes/WritingMyResults'
import WritingSession from './routes/WritingSession'
import WritingResults from './routes/WritingResults'
import WritingExam from './routes/WritingExam'
import WritingExamResults from './routes/WritingExamResults'
import Listening from './routes/Listening'
import ListeningPracticeBrowse from './routes/ListeningPracticeBrowse'
import ListeningExamBrowse from './routes/ListeningExamBrowse'
import ListeningPracticeSession from './routes/ListeningPracticeSession'
import ListeningExam from './routes/ListeningExam'
import ListeningResults from './routes/ListeningResults'
import ListeningMyResults from './routes/ListeningMyResults'
import Chat from './routes/Chat'
import Flashcards from './routes/Flashcards'
import FlashcardDeckPage from './routes/FlashcardDeck'
import FlashcardStudy from './routes/FlashcardStudy'
import Profile from './routes/Profile'
import EditProfile from './routes/EditProfile'
import Settings from './routes/Settings'
import BlockedUsers from './routes/BlockedUsers'
import ReportedUsers from './routes/ReportedUsers'
import PostDetail from './routes/PostDetail'
import Search from './routes/Search'
import Analytics from './routes/Analytics'
import Notifications from './routes/Notifications'
import NotFound from './routes/NotFound'
import RequireCompletedProfile from './components/RequireCompletedProfile'

import {chatSocket} from './lib/chatSocket'
import {checkAccountStatusOnce, markBannedNow, stopAccountStatusChecker} from './lib/accountStatus'
import AccountBannedOverlay from './components/AccountBannedOverlay'

export default function App() {

    // Admin/Owner userni ban yoki unban qilganda ishlaydigan markaziy
    // oqim. To'liq mantiq lib/accountStatus.ts'da (ban bo'lmagan
    // foydalanuvchi uchun bu yerda HECH QANDAY davriy so'rov
    // ishga tushmaydi — faqat banned bo'lgandagina poller boshlanadi).
    useEffect(() => {
        // 1) Sahifa banned holatda (qayta) ochilgan bo'lishi mumkin —
        // masalan foydalanuvchi ban paytida sahifani yangilagan. Bunda
        // ACCOUNT_BANNED signali WebSocket orqali kelmaydi (chunki hali
        // ulanish ochilmagan), shuning uchun bir martalik REST tekshiruv
        // bilan aniqlaymiz — aks holda chatSocket cheksiz qayta ulanishga
        // urinib, backendga keraksiz yuklama beraverardi.
        checkAccountStatusOnce()

        // 2) Foydalanuvchi ilovada turgan paytida ban qilinsa, signal
        // WebSocket orqali darhol keladi (qarang: AdminServiceImpl.banUser
        // -> NotificationService.sendSystem + sendAccountBanned).
        const unsubscribe = chatSocket.subscribe((signal) => {
            const isBannedNotification =
                signal.type === 'NOTIFICATION' &&
                (signal.payload as { type?: string } | undefined)?.type === 'BANNED'

            const isBannedSignal = signal.type === 'ACCOUNT_BANNED'

            if (isBannedNotification || isBannedSignal) {
                console.log('🔴 Account banned')

                // NOTIFICATION(BANNED) payloadida sarlavha/matn bo'lsa
                // (odatda ACCOUNT_BANNED signalidan OLDIN keladi — qarang
                // AdminServiceImpl.banUser), o'shani overlayда ko'rsatamiz.
                const payload = signal.payload as
                    | { title?: string; message?: string }
                    | undefined

                markBannedNow({
                    title: payload?.title,
                    message: payload?.message,
                })
            }
        })

        return () => {
            unsubscribe()
            stopAccountStatusChecker()
        }
    }, [])

    return (
        <CallLayer>
        {/* Ban real-time overlay — chatSocket'dan signal kelgan zahoti
            (yoki banned holatda sahifa qayta ochilganda) sahifa
            yangilanishisiz/keyingi so'rovni kutmasdan ko'rinadi. Routes
            tashqarisida — qaysi sahifada bo'lishidan qat'i nazar ustidan
            chiqadi. */}
        <AccountBannedOverlay />
        <Routes>
            {/* Ochiq (public) yo'llar — profileCompleted talab qilinmaydi.
                Landing/SignIn — hali umuman login qilinmagan; Onboarding
                va CefrTest — aynan onboardingning O'ZI (shuning uchun
                profil hali "tugallanmagan" holatda ham ochiq bo'lishi
                SHART, aks holda foydalanuvchi hech qachon onboardingni
                tugata olmas edi). */}
            <Route path="/" element={<Landing/>}/>
            <Route path="/sign-in" element={<SignIn/>}/>
            <Route path="/onboarding" element={<Onboarding/>}/>
            <Route path="/cefr-test" element={<CefrTest/>}/>

            {/* MUHIM: quyidagi barcha route'lar RequireCompletedProfile
                ostida — bitta markaziy "layout" guard orqali himoyalangan.
                Bu guard: (1) login qilinmagan bo'lsa /sign-in'ga,
                (2) login qilingan-u onboarding tugallanmagan bo'lsa
                /onboarding'ga yo'naltiradi. Shu tufayli endi
                `localhost:5173/#/dashboard` kabi to'g'ridan-to'g'ri
                manzilga kirish onboardingdan "yashirincha" o'tib
                ketolmaydi — har bir alohida sahifaga bu tekshiruvni
                qayta-qayta yozish shart emas. */}
            <Route element={<RequireCompletedProfile/>}>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/search" element={<Search/>}/>
                <Route path="/analytics" element={<Analytics/>}/>
                <Route path="/notifications" element={<Notifications/>}/>
                <Route path="/learn" element={<Learn/>}/>

                {/* Reading */}
                <Route path="/learn/reading" element={<Reading/>}/>
                <Route path="/learn/reading/practice/:id" element={<ReadingPracticeSession/>}/>
                <Route path="/learn/reading/exam/:id" element={<ReadingExam/>}/>
                <Route path="/learn/reading/results/:id" element={<ReadingResults/>}/>
                <Route path="/learn/reading/my-results" element={<ReadingMyResults/>}/>
                <Route path="/learn/reading/:id" element={<ReadingReader/>}/>

                {/* Exercises */}
                <Route path="/learn/exercises" element={<Exercises/>}/>
                <Route path="/learn/exercises/session/:checkpointId" element={<ExerciseSession/>}/>
                <Route path="/admin/cefr-generation" element={<AdminCefrGeneration/>}/>
                <Route path="/admin" element={<AdminPanel/>}/>

                {/* Writing */}
                <Route path="/learn/writing" element={<Writing/>}/>
                <Route path="/learn/writing/my-results" element={<WritingMyResults/>}/>
                <Route path="/learn/writing/exam" element={<WritingExam/>}/>
                <Route path="/learn/writing/exam-results/:sessionId" element={<WritingExamResults/>}/>
                <Route path="/learn/writing/session/:questionId" element={<WritingSession/>}/>
                <Route path="/learn/writing/results/:submissionId" element={<WritingResults/>}/>

                {/* Listening — YANGI STRUKTURA */}
                <Route path="/learn/listening" element={<Listening/>}/>

                {/* Practice — browse + session */}
                <Route path="/learn/listening/practice" element={<ListeningPracticeBrowse/>}/>
                <Route path="/learn/listening/practice/:id" element={<ListeningPracticeSession/>}/>

                {/* Exam — hozircha mavjud sahifadan foydalanamiz */}
                <Route path="/learn/listening/exam" element={<Navigate to="/learn/listening/exam-browse" replace/>}/>
                <Route path="/learn/listening/exam-browse" element={<ListeningExamBrowse/>}/>
                <Route path="/learn/listening/exam/:id" element={<ListeningExam/>}/>

                {/* Results — mavjud sahifa */}
                <Route path="/learn/listening/results/:id" element={<ListeningResults/>}/>
                <Route path="/learn/listening/my-results" element={<ListeningMyResults/>}/>

                {/* Eski link'lar uchun redirect — /material/:id → /practice/:id */}
                <Route
                    path="/learn/listening/material/:id"
                    element={<Navigate to="/learn/listening/practice" replace/>}
                />
                <Route path="/chat" element={<Chat/>}/>

                {/* Flashcards */}
                <Route path="/flashcards" element={<Flashcards/>}/>
                <Route path="/flashcards/:id" element={<FlashcardDeckPage/>}/>
                <Route path="/flashcards/:id/study" element={<FlashcardStudy/>}/>

                {/* Profile */}
                <Route path="/profile/edit" element={<EditProfile/>}/>
                <Route path="/settings" element={<Settings/>}/>
                <Route path="/profile/blocked" element={<BlockedUsers/>}/>
                <Route path="/profile/reported" element={<ReportedUsers/>}/>
                <Route path="/profile/:userId" element={<Profile/>}/>

                {/* Post — share link ochiladigan joy */}
                <Route path="/posts/:postId" element={<PostDetail/>}/>
            </Route>

            {/* Mos route topilmasa — oq/blank ekran o'rniga 404.
                Guard ostida EMAS — login qilinmagan/onboarding
                tugallanmagan foydalanuvchi ham noto'g'ri manzil uchun
                404'ni ko'rishi kerak, majburan sign-in/onboarding'ga
                uloqtirilmasdan. */}
            <Route path="*" element={<NotFound/>}/>
        </Routes>
        </CallLayer>
    )
}
