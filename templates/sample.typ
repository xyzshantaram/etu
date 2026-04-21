// Sample Typst template for etu log reports
#let ctx = json.decode(sys.inputs.ctx)

#let project = ctx.project
#let sessions = ctx.sessions
#let memos = ctx.memos
#let currency = ctx.currency
#let elapsed = ctx.elapsed
#let decimalHours = ctx.decimalHours
#let gross = ctx.gross
#let advanceRemaining = ctx.advanceRemaining
#let finalAmount = ctx.finalAmount
#let hoursExpr = ctx.hoursExpr
#let totalExpenses = ctx.totalExpenses
#let finalWithExpenses = ctx.finalWithExpenses
#let currentSession = ctx.currentSession
#let ongoingTime = ctx.ongoingTime
#let invoiceDate = ctx.invoiceDate
#let dueDate = ctx.dueDate

#let showInvoiceMeta = true

#let expenses = memos.filter(m => m.type == "expense")
#let kvMemos = memos.filter(m => m.type == "kv")

#if sessions.len() == 0 and expenses.len() == 0 and kvMemos.len() == 0 {
  panic("No sessions, expenses, or memos found. Cannot generate invoice.")
}

#let formatTime(ms) = {
  let seconds = calc.floor(ms / 1000)
  let minutes = calc.floor(seconds / 60)
  let hours = calc.floor(minutes / 60)
  let days = calc.floor(hours / 24)

  let result = ()

  if days > 0 {
    result.push(str(days) + " day" + if days != 1 { "s" } else { "" })
    hours = calc.rem(hours, 24)
  }
  if hours > 0 {
    result.push(str(hours) + " hour" + if hours != 1 { "s" } else { "" })
    minutes = calc.rem(minutes, 60)
  }
  if minutes > 0 {
    result.push(str(minutes) + " minute" + if minutes != 1 { "s" } else { "" })
    seconds = calc.rem(seconds, 60)
  }
  if seconds > 0 and days == 0 and hours == 0 {
    result.push(str(seconds) + " second" + if seconds != 1 { "s" } else { "" })
  }

  if result.len() == 0 { return "0 seconds" }
  if result.len() == 1 { return result.at(0) }

  let joined = result.slice(0, -1).join(", ")
  joined + " and " + result.last()
}

#set document(title: "Invoice: " + project.name)

#align(center)[
  #text(size: 24pt, weight: "bold")[INVOICE]
]

#v(1em)

#text(weight: "bold")[ACME Inc.]
#linebreak()
123 Business Street
#linebreak()
Suite 100
#linebreak()
City, State 12345
#linebreak()
contact\@acme.com

#v(0.5em)
#line(length: 100%, stroke: 2pt)
#v(0.5em)

#grid(
  columns: (1fr, 1fr),
  gutter: 1em,
  [
    #text(weight: "bold")[Bill To:]
    #linebreak()
    Client Name
    #linebreak()
    456 Client Avenue
    #linebreak()
    Client City, State 67890
  ],
  if showInvoiceMeta [
    #align(right)[
      #text(weight: "bold")[Date:] #invoiceDate
      #linebreak()
      #text(weight: "bold")[Due Date:] #dueDate
      #linebreak()
      #text(weight: "bold")[Invoice \#:] INV-2024-001
    ]
  ],
)

#v(0.5em)
#line(length: 100%, stroke: 2pt)
#v(1em)

#if sessions.len() > 0 [
  = Sessions

  #table(
    columns: (auto, 1fr, auto, auto),
    inset: 0.5em,
    stroke: none,
    align: (center, left, left, left),
    fill: (x, y) => if y == 0 { black } else { none },
    [#text(fill: white, weight: "bold")[\#]],
    [#text(fill: white, weight: "bold")[Name]],
    [#text(fill: white, weight: "bold")[From]],
    [#text(fill: white, weight: "bold")[Duration]],

    ..sessions
      .enumerate()
      .map(((idx, session)) => {
        (
          str(idx + 1),
          if session.name != none { session.name } else { "(untitled)" },
          session.startFormatted,
          if session.end != none {
            formatTime(session.end - session.start)
          } else {
            formatTime(ctx.now - session.start)
          },
        )
      })
      .flatten(),
  )
]

#if expenses.len() > 0 [
  #v(1em)
  = Expenses

  #table(
    columns: (1fr, auto, 2fr),
    inset: 0.5em,
    stroke: none,
    align: (left, left, left),
    fill: (x, y) => if y == 0 { black } else { none },
    [#text(fill: white, weight: "bold")[Name]],
    [#text(fill: white, weight: "bold")[Amount]],
    [#text(fill: white, weight: "bold")[Description]],

    ..expenses
      .map(exp => {
        (
          exp.name,
          text(fill: rgb("#27ae60"), weight: "bold")[#currency#str(exp.cost)],
          if "description" in exp and exp.description != none { exp.description } else { "" },
        )
      })
      .flatten(),
  )
]

#v(1em)

#if sessions.len() > 0 or expenses.len() > 0 [
  = Amount Due

  #table(
    columns: (1fr, auto),
    inset: 0.75em,
    stroke: none,
    align: (left, left),
    ..if sessions.len() > 0 {
      (
        [*Total time spent*],
        [#formatTime(elapsed) (#str(decimalHours) hours)],
        [*Hourly rate*],
        [#currency#str(project.rate)/hour],
        [*Gross amount*],
        [#text(fill: rgb("#27ae60"), weight: "bold")[#currency#str(gross)]],
      )
    } else {
      ()
    },
    ..if totalExpenses > 0 {
      ([*+ Expenses*], [#text(fill: rgb("#27ae60"), weight: "bold")[#currency#str(totalExpenses)]])
    } else {
      ()
    },
    ..if sessions.len() > 0 {
      (
        [*Hours paid in advance*],
        [#str(project.advance) hours \( #currency#(calc.floor(project.rate * decimal(project.advance))) )],
      )
    } else {
      ()
    },
    table.hline(stroke: 2pt),
    [*Amount Payable*],
    [#text(size: 1.2em, fill: rgb("#27ae60"), weight: "bold")[#currency#str(if sessions.len() > 0 { finalWithExpenses } else { totalExpenses })]],
  )

  #if advanceRemaining > 0 [
    #v(0.5em)
    #text(fill: rgb("#e67e22"))[*Note:* Advance remaining: #formatTime(advanceRemaining)]
  ]
] else if kvMemos.len() > 0 [
  = Amount Due

  #table(
    columns: (1fr, auto),
    inset: 0.5em,
    stroke: none,
    align: (left, left),
    table.hline(stroke: 2pt),
    [*Amount Payable:*], [#text(size: 1.2em, fill: rgb("#27ae60"), weight: "bold")[#currency#str(0.00)]],
  )
]

#v(1em)
#line(length: 100%, stroke: 1pt + gray)

= Payment Terms

Payment is due within 30 days of invoice date.

Please make payment via:
- Bank transfer to [Account Details]
- Check payable to ACME Inc.
- Online payment at [Payment URL]

Thank you for your business!

#if currentSession != none [
  #v(1em)
  = Current Session

  - *Name:* #if currentSession.name != none { currentSession.name } else { "(untitled)" }
  - *Started at:* #currentSession.startFormatted
  - *Time spent:* #formatTime(ongoingTime)
]

#if kvMemos.len() > 0 [
  #v(1em)
  = Memos

  #for memo in kvMemos [
    - *#memo.name:* #if "description" in memo and memo.description != none { memo.description } else { "" }
  ]
]
