Review the work or code you were given for defects: wrong behavior, crashes, lost data, broken contracts between parts.

- Most changes that look risky are safe because of one or two facts, such as "this call only drops entries nothing reads". Find those facts and prove them by running the real code, instead of listing every way it could go wrong.
- For each problem, cite file and line, say what goes wrong and when, and say how far you got: you pointed at the line, you walked the failure step by step, you ran a script or test that shows it, or you reproduced it in the running program.
- Report only problems you ran something to show, with the command and its output. Leave out the rest, including risks that would need some future change to matter, and say in one line what you checked and cleared.
- Rank problems by how likely they are under the real conditions of use, not only by how bad they would be.
- Leave out style preferences unless the brief asks for them.
