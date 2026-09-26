.data

.text
# function main
# int main()
.globl main
main:
# function prologue
#  make room for $fp old value
addi $sp,$sp,-4
#  Push frame pointer onto the stack
sw $fp,0($sp)
#  initialize this frame's $fp
addiu $fp,$sp,0
addiu $sp,$sp,-12
addiu $sp,$sp,-4
sw $t0,0($sp)
addiu $sp,$sp,-4
sw $t1,0($sp)
addiu $sp,$sp,-4
sw $t2,0($sp)
# function body

# addr of local var i : size = 4, type int
addi $t1,$fp,-8
li $t0,0
# store IntLiteral -> i
sw $t0,0($t1)

# addr of local var sum : size = 4, type int
addi $t0,$fp,-12
li $t1,0
# store IntLiteral -> sum
sw $t1,0($t0)
label_2_while_start:

# addr of local var i : size = 4, type int
addi $t0,$fp,-8
lw $t0,0($t0)
li $t1,3
slt $t0,$t0,$t1
beqz $t0,label_3_while_end

# addr of local var sum : size = 4, type int
addi $t2,$fp,-12

# addr of local var sum : size = 4, type int
addi $t0,$fp,-12
lw $t1,0($t0)

# addr of local var i : size = 4, type int
addi $t0,$fp,-8
lw $t0,0($t0)
addu $t0,$t1,$t0
# store BinOp -> sum
sw $t0,0($t2)

# addr of local var i : size = 4, type int
addi $t1,$fp,-8

# addr of local var i : size = 4, type int
addi $t0,$fp,-8
lw $t0,0($t0)
li $t2,1
addu $t0,$t0,$t2
# store BinOp -> i
sw $t0,0($t1)
j label_2_while_start
label_3_while_end:
# Copy return value on the stack

# addr of local var sum : size = 4, type int
addi $t0,$fp,-12
lw $t0,0($t0)
sw $t0,4($fp)
j main_epilogue
# function epilogue
main_epilogue:
lw $t2,0($sp)
addiu $sp,$sp,4
lw $t1,0($sp)
addiu $sp,$sp,4
lw $t0,0($sp)
addiu $sp,$sp,4
# restore stack pointer
addi $sp,$fp,4
# restore frame pointer
lw $fp,0($fp)

# main exit syscall
li $v0,10
syscall

